import type {
  CandidateSnippet,
  ExtractedSignals,
  RankedSignals,
} from './types.js';

function rankSnippets(candidates: CandidateSnippet[]): CandidateSnippet[] {
  return [...candidates].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if (left.source !== right.source) {
      const sourceWeight = {
        stderr: 3,
        combined: 2,
        stdout: 1,
      } as const;
      return sourceWeight[right.source] - sourceWeight[left.source];
    }

    return left.startLine - right.startLine;
  });
}

function rankFiles(files: string[]): string[] {
  return [...files].sort((left, right) => {
    const leftDepth = left.split('/').length;
    const rightDepth = right.split('/').length;

    if (leftDepth !== rightDepth) {
      return rightDepth - leftDepth;
    }

    return left.localeCompare(right);
  });
}

function rankKeywords(keywords: string[]): string[] {
  return [...keywords].sort((left, right) => {
    const leftUpper = /^[A-Z0-9_:-]+$/.test(left);
    const rightUpper = /^[A-Z0-9_:-]+$/.test(right);

    if (leftUpper !== rightUpper) {
      return Number(rightUpper) - Number(leftUpper);
    }

    return right.length - left.length;
  });
}

export function rankSignals(signals: ExtractedSignals): RankedSignals {
  const rankedSnippets = rankSnippets(signals.snippets);
  const rankedStackLines = [...signals.stackLines].sort((left, right) => {
    const leftFrame = /^\s*at\s+/.test(left) || /^\s*#\d+\s/.test(left);
    const rightFrame = /^\s*at\s+/.test(right) || /^\s*#\d+\s/.test(right);

    if (leftFrame !== rightFrame) {
      return Number(rightFrame) - Number(leftFrame);
    }

    return left.localeCompare(right);
  });

  return {
    snippet: rankedSnippets[0]?.text,
    stackLines: rankedStackLines.slice(0, 8),
    relatedFiles: rankFiles(signals.relatedFiles).slice(0, 10),
    keywords: rankKeywords(signals.keywords).slice(0, 10),
  };
}
