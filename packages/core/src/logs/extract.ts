import type {
  CandidateSnippet,
  ExtractedSignals,
  LogSegment,
  SegmentedLog,
} from './types.js';

const FILE_PATTERN =
  /(?:^|[\s("'`])((?:\.{0,2}\/)?(?:[\w@%+=:,.-]+\/)*[\w@%+=,.-]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|java|kt|kts|scala|go|rs|php|py|rb|swift|c|cc|cpp|h|hpp|cs|vue|svelte|yaml|yml|toml|xml|gradle|properties))(?:[:(]\d+(?::\d+)?)?/g;
const GENERIC_PATH_PATTERN =
  /(?:^|[\s("'`])((?:\.{0,2}\/)?(?:[\w@%+=:,.-]+\/)+[\w@%+=,.-]+)(?:[:(]\d+(?::\d+)?)?/g;

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function scoreSegment(segment: LogSegment): number {
  const text = segment.text;
  let score = 0;

  if (segment.source === 'stderr') {
    score += 30;
  } else if (segment.source === 'combined') {
    score += 10;
  }

  if (/\b(error|exception|panic|fatal|failed|failure)\b/i.test(text)) {
    score += 25;
  }

  if (/\b[A-Z][A-Za-z]+(?:Error|Exception)\b/.test(text)) {
    score += 20;
  }

  if (/\b[A-Z]{2,}[A-Z0-9_:-]{1,}\b/.test(text)) {
    score += 15;
  }

  if (FILE_PATTERN.test(text)) {
    score += 20;
  }

  if (/:\d+(?::\d+)?/.test(text)) {
    score += 12;
  }

  if (/^at\s+/m.test(text) || /^#\d+\s/m.test(text)) {
    score += 10;
  }

  if (segment.lines.length > 8) {
    score -= 8;
  }

  return score;
}

function extractSnippetCandidates(segments: LogSegment[]): CandidateSnippet[] {
  return segments
    .map((segment) => ({
      text: segment.text,
      source: segment.source,
      segmentId: segment.id,
      startLine: segment.startLine,
      endLine: segment.endLine,
      score: scoreSegment(segment),
    }))
    .filter((candidate) => candidate.score > 0);
}

function extractStackLines(segments: LogSegment[]): string[] {
  const lines = segments.flatMap((segment) => segment.lines);
  return unique(
    lines.filter(
      (line) =>
        /^\s*at\s+/.test(line) ||
        /^\s*#\d+\s/.test(line) ||
        /^\s*caused by:/i.test(line) ||
        /\b(?:[A-Za-z]:)?[^:\s]+\.(?:ts|tsx|js|jsx|java|go|rs|php|py|rb|swift|cs):\d+(?::\d+)?\b/.test(
          line,
        ),
    ),
  ).slice(0, 12);
}

function normalizeFileMatch(match: string): string {
  return match
    .trim()
    .replace(/[):,]+$/g, '')
    .replace(/:\d+(?::\d+)?$/g, '');
}

function extractRelatedFiles(segments: LogSegment[]): string[] {
  const files: string[] = [];

  for (const segment of segments) {
    for (const match of segment.text.matchAll(FILE_PATTERN)) {
      const candidate = normalizeFileMatch(match[1] ?? '');
      if (candidate.length > 0) {
        files.push(candidate);
      }
    }

    for (const match of segment.text.matchAll(GENERIC_PATH_PATTERN)) {
      const candidate = normalizeFileMatch(match[1] ?? '');
      if (candidate.length > 0) {
        files.push(candidate);
      }
    }
  }

  return unique(files).slice(0, 20);
}

function extractKeywords(segments: LogSegment[]): string[] {
  const keywords: string[] = [];
  const patterns = [
    /\b[A-Z]{2,}[A-Z0-9_:-]{1,}\b/g,
    /\b[A-Z][A-Za-z]+(?:Error|Exception)\b/g,
    /\b(?:not found|permission denied|syntax error|undefined reference|segmentation fault|module not found)\b/gi,
  ];

  for (const segment of segments) {
    for (const pattern of patterns) {
      for (const match of segment.text.matchAll(pattern)) {
        keywords.push(match[0]);
      }
    }
  }

  return unique(keywords).slice(0, 16);
}

export function extractSignals(segmented: SegmentedLog): ExtractedSignals {
  const segments = segmented.segments;

  return {
    snippets: extractSnippetCandidates(segments),
    stackLines: extractStackLines(segments),
    relatedFiles: extractRelatedFiles(segments),
    keywords: extractKeywords(segments),
  };
}
