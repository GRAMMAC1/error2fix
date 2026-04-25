import {
  buildCoreAnalysisInput,
  diagnoseCapture,
  shortHash,
} from '@error2fix/core';
import type {
  CoreAnalysis,
  CoreErrorSignalSet,
  LatestRawCapture,
} from '@error2fix/core';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { z } from 'zod';
import {
  DEFAULT_MAX_CHARS_PER_EVIDENCE_SECTION,
  DEFAULT_MAX_EVIDENCE,
  DEFAULT_MAX_EVIDENCE_SECTIONS,
  DEFAULT_MAX_SNIPPET_CHARS,
  DEFAULT_RUNTIME_CONTEXT_SECTIONS,
  EVIDENCE_CONTEXT_LINES,
  SAFE_ENV_KEY_PATTERN,
  SECRET_ENV_KEY_PATTERN,
  WORKFLOW_DESCRIPTION,
} from '../constants/index.js';
import {
  rememberBriefSession,
  resolveBriefSession,
} from '../store/brief-session-store.js';
import type { BriefSessionContext } from '../store/brief-session-store.js';
import {
  getLatestFailureBriefInputSchema,
  getLatestFailureBriefResultSchema,
  getRuntimeContextInputSchema,
  getRuntimeContextResultSchema,
  queryFailureEvidenceInputSchema,
  queryFailureEvidenceResultSchema,
} from './tool-protocol.js';
import type {
  DiagnosisEvidence,
  EvidenceSection,
  GetLatestFailureBriefArgs,
  GetLatestFailureBriefResult,
  GetRuntimeContextArgs,
  GetRuntimeContextResult,
  QueryFailureEvidenceArgs,
  QueryFailureEvidenceResult,
  RuntimeContextSection,
} from './tool-protocol.js';

function notImplementedResult<T extends z.ZodTypeAny>(
  schema: T,
  message: string,
): z.infer<T> {
  return schema.parse({
    ok: false,
    error: {
      code: 'NOT_IMPLEMENTED',
      message,
    },
  });
}

function makeToolText(result: {
  ok: boolean;
  error?: { message: string };
}): string {
  if (result.ok) {
    return 'Structured diagnosis data is available.';
  }
  return result.error?.message ?? 'Unknown error';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function truncate(
  text: string | undefined,
  maxChars: number,
): string | undefined {
  if (!text) {
    return undefined;
  }
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function makeSessionId(capture: LatestRawCapture): string {
  return shortHash(
    [
      capture.metadata.timestamp,
      capture.metadata.cwd,
      capture.metadata.command,
      String(capture.metadata.exitCode),
      capture.stdout,
      capture.stderr,
    ].join('\n'),
  );
}

function buildCaptureFromArgs(
  args: GetLatestFailureBriefArgs,
): LatestRawCapture | undefined {
  const stdout = args.logs.stdout;
  const stderr = args.logs.stderr;

  if (stdout.trim().length === 0 && stderr.trim().length === 0) {
    return undefined;
  }

  return {
    metadata: {
      command: args.command?.raw ?? 'unknown command',
      exitCode: args.command?.exitCode ?? 1,
      cwd: args.command?.cwd ?? process.cwd(),
      shell: args.command?.shell ?? 'unknown',
      timestamp: args.command?.timestamp ?? Date.now().toString(),
    },
    stdout,
    stderr,
    stdoutLogFile: '',
    stderrLogFile: '',
  };
}

// TODO need smarter signal extraction and ranking to improve confidence inference and surface more focused evidence instead of generic keywords and stack lines
function inferConfidence(
  analysis: CoreAnalysis,
  signals: CoreErrorSignalSet,
): number {
  const matchedSpecificPlugin = analysis.pluginResults.some(
    (result) => result.matched && result.plugin !== 'builtin-generic',
  );
  if (matchedSpecificPlugin && analysis.keySnippet) {
    return 0.9;
  }
  if (analysis.keySnippet && signals.relatedFiles.length > 0) {
    return 0.8;
  }
  if (analysis.keySnippet || signals.keywords.length > 0) {
    return 0.65;
  }
  return 0.45;
}

function buildDiagnosisEvidence(
  analysis: CoreAnalysis,
  coreSignals: CoreErrorSignalSet,
  maxEvidence: number,
  maxSnippetChars: number,
): DiagnosisEvidence[] {
  const candidates = unique([
    analysis.keySnippet ?? '',
    coreSignals.snippet ?? '',
    ...coreSignals.stackLines,
  ]);

  return candidates.slice(0, maxEvidence).map((candidate, index) => {
    const excerpt = truncate(candidate, maxSnippetChars) ?? candidate;
    return {
      id: `evidence-${index + 1}`,
      excerpt,
    };
  });
}

function buildEvidenceSeeds(
  analysis: CoreAnalysis,
  coreSignals: CoreErrorSignalSet,
): string[] {
  return unique([
    analysis.keySnippet ?? '',
    coreSignals.snippet ?? '',
    ...coreSignals.stackLines,
  ]);
}

function getEvidenceSeedById(
  evidenceId: string,
  analysis: CoreAnalysis,
  coreSignals: CoreErrorSignalSet,
): string | undefined {
  const match = /^evidence-(\d+)$/.exec(evidenceId);
  if (!match) {
    return undefined;
  }
  const index = Number.parseInt(match[1] ?? '', 10) - 1;
  return buildEvidenceSeeds(analysis, coreSignals)[index];
}

function splitLogLines(capture: LatestRawCapture): string[] {
  return [capture.stderr, capture.stdout]
    .filter((text) => text.trim().length > 0)
    .join('\n')
    .split(/\r?\n/);
}

function findLineIndex(lines: string[], term: string): number {
  const normalizedTerm = term.trim().toLowerCase();
  if (!normalizedTerm) {
    return -1;
  }
  return lines.findIndex((line) => line.toLowerCase().includes(normalizedTerm));
}

function sliceAroundLine(lines: string[], index: number): string {
  const start = Math.max(0, index - EVIDENCE_CONTEXT_LINES);
  const end = Math.min(lines.length, index + EVIDENCE_CONTEXT_LINES + 1);
  return lines.slice(start, end).join('\n').trim();
}

function findRelatedFiles(excerpt: string, files: string[]): string[] {
  return files.filter((file) => excerpt.includes(file)).slice(0, 5);
}

function findKeywords(excerpt: string, keywords: string[]): string[] {
  const lowerExcerpt = excerpt.toLowerCase();
  return keywords
    .filter((keyword) => lowerExcerpt.includes(keyword.toLowerCase()))
    .slice(0, 8);
}

function makeEvidenceSection(
  id: string,
  title: string,
  reason: string,
  excerpt: string,
  analysis: CoreAnalysis,
  signals: CoreErrorSignalSet,
  maxChars: number,
): EvidenceSection {
  const truncatedExcerpt = truncate(excerpt, maxChars) ?? excerpt;
  return {
    id,
    title,
    reason,
    excerpt: truncatedExcerpt,
    relatedFiles: findRelatedFiles(truncatedExcerpt, analysis.relatedFiles),
    keywords: findKeywords(truncatedExcerpt, signals.keywords),
  };
}

function addSectionForTerm(params: {
  sections: EvidenceSection[];
  lines: string[];
  term: string;
  title: string;
  reason: string;
  analysis: CoreAnalysis;
  signals: CoreErrorSignalSet;
  maxChars: number;
}): void {
  const index = findLineIndex(params.lines, params.term);
  if (index < 0) {
    return;
  }
  const excerpt = sliceAroundLine(params.lines, index);
  if (!excerpt) {
    return;
  }
  params.sections.push(
    makeEvidenceSection(
      `section-${params.sections.length + 1}`,
      params.title,
      params.reason,
      excerpt,
      params.analysis,
      params.signals,
      params.maxChars,
    ),
  );
}

function dedupeEvidenceSections(
  sections: EvidenceSection[],
): EvidenceSection[] {
  const seen = new Set<string>();
  const deduped: EvidenceSection[] = [];
  for (const section of sections) {
    const key = section.excerpt;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push({
      ...section,
      id: `section-${deduped.length + 1}`,
    });
  }
  return deduped;
}

function buildEvidenceSections(
  session: BriefSessionContext,
  args: QueryFailureEvidenceArgs,
  maxSections: number,
  maxCharsPerSection: number,
): EvidenceSection[] {
  const lines = splitLogLines(session.capture);
  const sections: EvidenceSection[] = [];
  const { analysis, input } = session;

  const primaryExcerpt = analysis.keySnippet ?? input.signals.snippet;
  if (primaryExcerpt) {
    sections.push(
      makeEvidenceSection(
        'section-1',
        'Primary failure evidence',
        'Highest-ranked failure snippet from the cached diagnosis.',
        primaryExcerpt,
        analysis,
        input.signals,
        maxCharsPerSection,
      ),
    );
  }

  for (const evidenceId of args.focus?.evidenceIds ?? []) {
    const seed = getEvidenceSeedById(evidenceId, analysis, input.signals);
    if (!seed) {
      continue;
    }
    const firstLine = seed
      .split(/\r?\n/)
      .find((line) => line.trim().length > 0);
    if (!firstLine) {
      continue;
    }
    addSectionForTerm({
      sections,
      lines,
      term: firstLine.trim(),
      title: `Expanded ${evidenceId}`,
      reason: `Expands cached diagnosis evidence ${evidenceId}.`,
      analysis,
      signals: input.signals,
      maxChars: maxCharsPerSection,
    });
  }

  for (const keyword of [
    ...(args.focus?.keywords ?? []),
    ...input.signals.keywords.slice(0, 3),
  ]) {
    addSectionForTerm({
      sections,
      lines,
      term: keyword,
      title: `Keyword evidence: ${keyword}`,
      reason: `Matches error keyword ${keyword}.`,
      analysis,
      signals: input.signals,
      maxChars: maxCharsPerSection,
    });
  }

  for (const file of [
    ...(args.focus?.files ?? []),
    ...analysis.relatedFiles.slice(0, 3),
  ]) {
    addSectionForTerm({
      sections,
      lines,
      term: file,
      title: `File evidence: ${file}`,
      reason: `References related file ${file}.`,
      analysis,
      signals: input.signals,
      maxChars: maxCharsPerSection,
    });
  }

  return dedupeEvidenceSections(sections).slice(0, maxSections);
}

function estimateReturnedChars(
  result: Omit<GetLatestFailureBriefResult, 'tokenPolicy'>,
): number {
  return JSON.stringify(result).length;
}

function buildSuggestedQueries(
  analysis: CoreAnalysis,
  signals: CoreErrorSignalSet,
): string[] {
  return unique([
    ...signals.keywords.slice(0, 3),
    ...analysis.relatedFiles.slice(0, 3),
  ]).slice(0, 5);
}

function shouldInclude(
  requestedSections: Set<RuntimeContextSection>,
  section: RuntimeContextSection,
): boolean {
  return requestedSections.has(section);
}

function isSafeEnvKey(key: string): boolean {
  return SAFE_ENV_KEY_PATTERN.test(key) && !SECRET_ENV_KEY_PATTERN.test(key);
}

function buildSafeEnv(
  env: Record<string, string> | undefined,
  envKeys: string[] | undefined,
): {
  safeEnv?: Record<string, string>;
  redactions?: Array<{
    key: string;
    reason: 'secret_like' | 'not_allowlisted' | 'too_large';
  }>;
} {
  if (!env) {
    return {};
  }

  const keys = envKeys ?? Object.keys(env).filter(isSafeEnvKey);
  const safeEnv: Record<string, string> = {};
  const redactions: Array<{
    key: string;
    reason: 'secret_like' | 'not_allowlisted' | 'too_large';
  }> = [];

  for (const key of keys) {
    if (!(key in env)) {
      continue;
    }
    if (SECRET_ENV_KEY_PATTERN.test(key)) {
      redactions.push({ key, reason: 'secret_like' });
      continue;
    }
    if (!isSafeEnvKey(key)) {
      redactions.push({ key, reason: 'not_allowlisted' });
      continue;
    }
    const value = env[key] ?? '';
    if (value.length > 500) {
      redactions.push({ key, reason: 'too_large' });
      continue;
    }
    safeEnv[key] = value;
  }

  return {
    safeEnv: Object.keys(safeEnv).length > 0 ? safeEnv : undefined,
    redactions: redactions.length > 0 ? redactions : undefined,
  };
}

export async function getLatestFailureBrief(
  args: GetLatestFailureBriefArgs,
): Promise<GetLatestFailureBriefResult> {
  const capture = buildCaptureFromArgs(args);
  if (!capture) {
    return getLatestFailureBriefResultSchema.parse({
      ok: false,
      error: {
        code: 'INVALID_SESSION',
        message:
          'No raw failure log was provided. Pass stdout and stderr strings in logs, using an empty string for streams with no output.',
      },
    });
  }

  try {
    const maxEvidence = clamp(args.maxEvidence ?? DEFAULT_MAX_EVIDENCE, 1, 10);
    const maxSnippetChars = clamp(
      args.maxSnippetChars ?? DEFAULT_MAX_SNIPPET_CHARS,
      1,
      4000,
    );
    const [input, analysis] = await Promise.all([
      buildCoreAnalysisInput(capture),
      diagnoseCapture(capture),
    ]);
    const confidence = inferConfidence(analysis, input.signals);
    const resultWithoutTokenPolicy: Omit<
      GetLatestFailureBriefResult,
      'tokenPolicy'
    > = {
      ok: true,
      sessionId: makeSessionId(capture),
      diagnosis: {
        summary: analysis.summary,
        confidence,
        excerpt: truncate(analysis.keySnippet, maxSnippetChars),
        causes: analysis.likelyCauses.slice(0, 3),
        files: analysis.relatedFiles.slice(0, 5),
        keywords: input.signals.keywords.slice(0, 8),
        evidence: buildDiagnosisEvidence(
          analysis,
          input.signals,
          maxEvidence,
          maxSnippetChars,
        ),
      },
      next: {
        canAnswerFromDiagnosis: confidence >= 0.75,
        recommendedTool:
          confidence >= 0.75 ? undefined : 'e2f_query_failure_evidence',
        reason:
          confidence >= 0.75
            ? 'The diagnosis includes a high-confidence failure signal.'
            : 'The diagnosis is available, but more focused evidence may improve the fix.',
        suggestedQueries: buildSuggestedQueries(analysis, input.signals),
      },
    };
    const sessionId = resultWithoutTokenPolicy.sessionId;
    if (sessionId) {
      rememberBriefSession(sessionId, capture, input, analysis);
    }

    return getLatestFailureBriefResultSchema.parse({
      ...resultWithoutTokenPolicy,
      tokenPolicy: {
        rawLogsOmitted: true,
        estimatedRawLogChars: capture.stdout.length + capture.stderr.length,
        returnedChars: estimateReturnedChars(resultWithoutTokenPolicy),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return getLatestFailureBriefResultSchema.parse({
      ok: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message,
      },
    });
  }
}

export async function queryFailureEvidence(
  args: QueryFailureEvidenceArgs,
): Promise<QueryFailureEvidenceResult> {
  const session = resolveBriefSession(args.sessionId);
  if (!session) {
    return queryFailureEvidenceResultSchema.parse({
      ok: false,
      error: {
        code: 'NO_FAILURE_SESSION',
        message:
          'No brief session context is available. Call e2f_get_latest_failure_brief first, or pass a valid sessionId.',
      },
    });
  }

  const maxSections = clamp(
    args.maxSections ?? DEFAULT_MAX_EVIDENCE_SECTIONS,
    1,
    8,
  );
  const maxCharsPerSection = clamp(
    args.maxCharsPerSection ?? DEFAULT_MAX_CHARS_PER_EVIDENCE_SECTION,
    1,
    4000,
  );
  const sections = buildEvidenceSections(
    session,
    args,
    maxSections,
    maxCharsPerSection,
  );

  return queryFailureEvidenceResultSchema.parse({
    ok: true,
    sessionId: session.sessionId,
    evidence: {
      summary:
        sections.length > 0
          ? `${sections.length} focused evidence section(s) from cached failure logs.`
          : 'No focused evidence sections matched the cached failure logs.',
      sections,
    },
  });
}

export async function getRuntimeContext(
  args: GetRuntimeContextArgs = {},
): Promise<GetRuntimeContextResult> {
  const session = resolveBriefSession(args.sessionId);
  if (!session) {
    return getRuntimeContextResultSchema.parse({
      ok: false,
      error: {
        code: 'NO_FAILURE_SESSION',
        message:
          'No brief session context is available. Call e2f_get_latest_failure_brief first, or pass a valid sessionId.',
      },
    });
  }

  const requestedSections = new Set(
    args.include ?? DEFAULT_RUNTIME_CONTEXT_SECTIONS,
  );
  const safeEnvResult = shouldInclude(requestedSections, 'safe_env')
    ? buildSafeEnv(session.input.capture.host.env, args.envKeys)
    : {};

  return getRuntimeContextResultSchema.parse({
    ok: true,
    sessionId: session.sessionId,
    contextSource: 'client_provided',
    command: shouldInclude(requestedSections, 'command')
      ? {
          raw: session.capture.metadata.command,
          cwd: session.capture.metadata.cwd,
          shell: session.capture.metadata.shell,
          exitCode: session.capture.metadata.exitCode,
          source: 'client_provided',
        }
      : undefined,
    os: shouldInclude(requestedSections, 'os')
      ? {
          ...session.input.capture.host.os,
          source: 'client_provided',
        }
      : undefined,
    shell: shouldInclude(requestedSections, 'shell')
      ? session.capture.metadata.shell
      : undefined,
    workspace: shouldInclude(requestedSections, 'workspace')
      ? {
          cwd: session.input.workspace.cwd,
          root: session.input.workspace.root,
          detectedFiles: session.input.workspace.files,
          source: 'client_provided',
        }
      : undefined,
    git: shouldInclude(requestedSections, 'git')
      ? {
          branch: session.input.workspace.git?.branch,
          source: 'client_provided',
        }
      : undefined,
    ...safeEnvResult,
  });
}

export function registerDiagnosisWorkflowTools(server: McpServer): void {
  server.registerTool(
    'e2f_get_latest_failure_brief',
    {
      title: 'Get Latest Failure Brief',
      description: [
        'Analyze raw terminal failure logs provided by the LLM client and return a compact, high-signal diagnosis. Always pass both logs.stdout and logs.stderr, using an empty string for streams with no output.',
        'Use this tool first before sending raw logs into model context.',
        'It returns a compact diagnosis, focused evidence excerpts, likely root-cause hints, and guidance on whether enough information is available to answer directly.',
        'This tool is optimized to reduce token usage by accepting raw stdout/stderr as tool input and returning only compact structured evidence.',
        WORKFLOW_DESCRIPTION,
      ].join(' '),
      inputSchema: getLatestFailureBriefInputSchema,
      outputSchema: getLatestFailureBriefResultSchema.shape,
    },
    async (args: GetLatestFailureBriefArgs) => {
      const result = await getLatestFailureBrief(args);
      return {
        content: [
          {
            type: 'text',
            text: makeToolText(result),
          },
        ],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'e2f_query_failure_evidence',
    {
      title: 'Query Failure Evidence',
      description: [
        'Query focused evidence from the latest captured failure log.',
        'Use this only when e2f_get_latest_failure_brief is insufficient.',
        'Prefer querying by evidence IDs returned by the diagnosis.',
        'This tool returns a few focused evidence sections instead of full raw logs.',
        WORKFLOW_DESCRIPTION,
      ].join(' '),
      inputSchema: queryFailureEvidenceInputSchema,
      outputSchema: queryFailureEvidenceResultSchema.shape,
    },
    async (args: QueryFailureEvidenceArgs) => {
      const result = await queryFailureEvidence(args);
      return {
        content: [
          {
            type: 'text',
            text: makeToolText(result),
          },
        ],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'e2f_get_runtime_context',
    {
      title: 'Get Runtime Context',
      description: [
        'Return safe runtime and workspace context for the latest captured failure.',
        'Use this when diagnosis depends on command facts, OS, shell, package manager, runtime versions, workspace files, git state, or allowlisted environment variables.',
        'Sensitive environment variables are never returned.',
        WORKFLOW_DESCRIPTION,
      ].join(' '),
      inputSchema: getRuntimeContextInputSchema,
      outputSchema: getRuntimeContextResultSchema.shape,
    },
    async (args: GetRuntimeContextArgs) => {
      const result = await getRuntimeContext(args);
      return {
        content: [
          {
            type: 'text',
            text: makeToolText(result),
          },
        ],
        structuredContent: result,
      };
    },
  );
}
