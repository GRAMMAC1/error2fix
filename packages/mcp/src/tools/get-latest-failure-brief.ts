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
import {
  DEFAULT_MAX_EVIDENCE,
  DEFAULT_MAX_SNIPPET_CHARS,
} from '../constants/index.js';
import { rememberBriefSession } from '../store/brief-session-store.js';
import { getLatestFailureBriefResultSchema } from './tool-protocol.js';
import type {
  DiagnosisEvidence,
  GetLatestFailureBriefArgs,
  GetLatestFailureBriefResult,
} from './tool-protocol.js';
import { clamp, truncate, unique } from './tool-utils.js';

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
