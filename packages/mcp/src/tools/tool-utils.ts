import { uniqueNonEmptyStrings } from '@error2fix/core';

export const unique = uniqueNonEmptyStrings;

export function makeToolText(result: {
  ok: boolean;
  error?: { message: string };
}): string {
  if (result.ok) {
    return 'Structured diagnosis data is available.';
  }
  return result.error?.message ?? 'Unknown error';
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function truncate(
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

function scoreFailureExcerpt(
  excerpt: string,
  relatedFiles: string[],
  keywords: string[],
): number {
  const lowerExcerpt = excerpt.toLowerCase();
  let score = 0;

  if (/\berror\s+[a-z]+\d+\b/i.test(excerpt)) {
    score += 8;
  }
  if (/\b[a-z]{2,}\d{3,}\b/i.test(excerpt)) {
    score += 4;
  }
  if (
    /\b(error|exception|failed|fatal|panic|syntaxerror|typeerror)\b/i.test(
      excerpt,
    ) ||
    /\b(not assignable|cannot find|module not found)\b/i.test(excerpt)
  ) {
    score += 4;
  }

  score += relatedFiles.filter((file) => excerpt.includes(file)).length * 5;
  score += keywords.filter((keyword) =>
    lowerExcerpt.includes(keyword.toLowerCase()),
  ).length;

  return score;
}

export function extractFocusedDiagnostic(
  excerpt: string,
  relatedFiles: string[],
): string | undefined {
  const lines = excerpt.split(/\r?\n/);
  const diagnosticLineIndex = lines.findIndex(
    (line) =>
      relatedFiles.some((file) => line.includes(file)) &&
      (/\berror\b/i.test(line) || /\b[a-z]{2,}\d{3,}\b/i.test(line)),
  );

  if (diagnosticLineIndex < 0) {
    return undefined;
  }

  const start = Math.max(0, diagnosticLineIndex - 1);
  const end = Math.min(lines.length, diagnosticLineIndex + 4);
  return lines.slice(start, end).join('\n').trim();
}

export function hasUsefulFailureSignal(
  excerpt: string,
  relatedFiles: string[],
  keywords: string[],
): boolean {
  return (
    scoreFailureExcerpt(excerpt, relatedFiles, filterUsefulKeywords(keywords)) >
    0
  );
}

export function selectBestFailureExcerpt(
  candidates: string[],
  relatedFiles: string[],
  keywords: string[],
): string | undefined {
  const uniqueCandidates = unique(candidates);
  const concreteDiagnostic = uniqueCandidates
    .map((excerpt) => extractFocusedDiagnostic(excerpt, relatedFiles))
    .find((excerpt) => excerpt !== undefined);
  if (concreteDiagnostic) {
    return concreteDiagnostic;
  }

  const [best] = uniqueCandidates
    .map((excerpt, index) => ({
      excerpt,
      index,
      score: scoreFailureExcerpt(
        excerpt,
        relatedFiles,
        filterUsefulKeywords(keywords),
      ),
    }))
    .sort(
      (left, right) => right.score - left.score || left.index - right.index,
    );

  return best?.excerpt;
}

export function filterUsefulKeywords(keywords: string[]): string[] {
  return keywords.filter((keyword) => {
    if (keyword.length > 30) {
      return false;
    }
    return !/^[A-Z0-9_]{16,}$/.test(keyword);
  });
}
