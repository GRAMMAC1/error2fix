import type { FailureEvidence } from './evidence.js';

function isApplicationFile(file: string | undefined): boolean {
  return Boolean(file && !/node_modules|dist|build|\.next|\.nuxt/.test(file));
}

function hasPreciseLocation(evidence: FailureEvidence): boolean {
  return Boolean(evidence.file && evidence.line);
}

function scoreEvidence(evidence: FailureEvidence): number {
  let score = evidence.priority + evidence.confidence;

  if (hasPreciseLocation(evidence)) {
    score += 12;
  } else if (evidence.file) {
    score += 6;
  }

  if (isApplicationFile(evidence.file)) {
    score += 8;
  }

  if (/\b(?:TS\d{3,5}|ERR_[A-Z_]+)\b/.test(evidence.message)) {
    score += 8;
  }

  if (
    /node_modules|webpack|rollup|vite|esbuild|tsx|tsc/i.test(
      evidence.file ?? '',
    )
  ) {
    score -= 8;
  }

  if (evidence.category === 'build_wrapper') {
    score -= 12;
  }

  if (evidence.source === 'generic') {
    score -= 40;
  }

  return score;
}

function evidenceKey(evidence: FailureEvidence): string {
  return [
    evidence.ruleId,
    evidence.file ?? '',
    evidence.line ?? '',
    evidence.column ?? '',
    evidence.message.toLowerCase(),
  ].join('|');
}

function overlapKey(evidence: FailureEvidence): string {
  return [
    evidence.file ?? '',
    evidence.line ?? '',
    evidence.message.toLowerCase().slice(0, 120),
  ].join('|');
}

export function reduceEvidence(
  evidences: FailureEvidence[],
): FailureEvidence[] {
  const exact = new Map<string, FailureEvidence>();

  for (const evidence of evidences) {
    const key = evidenceKey(evidence);
    const existing = exact.get(key);
    if (!existing || scoreEvidence(evidence) > scoreEvidence(existing)) {
      exact.set(key, evidence);
    }
  }

  const overlapped = new Map<string, FailureEvidence>();
  for (const evidence of exact.values()) {
    const key = overlapKey(evidence);
    const existing = overlapped.get(key);
    if (!existing || scoreEvidence(evidence) > scoreEvidence(existing)) {
      overlapped.set(key, evidence);
    }
  }

  return [...overlapped.values()];
}

export function rankEvidence(evidences: FailureEvidence[]): FailureEvidence[] {
  return [...evidences].sort((left, right) => {
    const scoreDelta = scoreEvidence(right) - scoreEvidence(left);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    const priorityDelta = right.priority - left.priority;
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    const rawLineDelta =
      (left.rawLine ?? Number.MAX_SAFE_INTEGER) -
      (right.rawLine ?? Number.MAX_SAFE_INTEGER);
    if (rawLineDelta !== 0) {
      return rawLineDelta;
    }

    return left.ruleId.localeCompare(right.ruleId);
  });
}
