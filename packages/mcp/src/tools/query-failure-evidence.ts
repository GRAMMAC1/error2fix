import type {
  CoreAnalysis,
  CoreErrorSignalSet,
  LatestRawCapture,
} from '@error2fix/core';
import {
  DEFAULT_MAX_CHARS_PER_EVIDENCE_SECTION,
  DEFAULT_MAX_EVIDENCE_SECTIONS,
  EVIDENCE_CONTEXT_LINES,
} from '../constants/index.js';
import { resolveBriefSession } from '../store/brief-session-store.js';
import type { BriefSessionContext } from '../store/brief-session-store.js';
import { queryFailureEvidenceResultSchema } from './tool-protocol.js';
import type {
  EvidenceSection,
  QueryFailureEvidenceArgs,
  QueryFailureEvidenceResult,
} from './tool-protocol.js';
import { clamp, truncate, unique } from './tool-utils.js';

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
