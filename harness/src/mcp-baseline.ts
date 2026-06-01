import type { BenchmarkResult } from './mcp-harness.js';

export interface McpBaselineCase {
  signalMatched: number;
  signalTotal: number;
  relatedFileMatched: number;
  relatedFileTotal: number;
  errorCodeMatched: number;
  errorCodeTotal: number;
  toolCalls: number;
  totalMcpChars: number;
}

export interface McpBaseline {
  version: 1;
  generatedFrom: 'pnpm harness:mcp:update';
  cases: Record<string, McpBaselineCase>;
}

export interface RegressionFailure {
  caseId: string;
  metric: string;
  baseline: number | string;
  current: number | string;
}

export function buildMcpBaseline(results: BenchmarkResult[]): McpBaseline {
  return {
    version: 1,
    generatedFrom: 'pnpm harness:mcp:update',
    cases: Object.fromEntries(
      results.map((result) => [
        result.id,
        {
          signalMatched: result.signalMatched,
          signalTotal: result.signalTotal,
          relatedFileMatched: result.relatedFileMatched,
          relatedFileTotal: result.relatedFileTotal,
          errorCodeMatched: result.errorCodeMatched,
          errorCodeTotal: result.errorCodeTotal,
          toolCalls: result.toolCalls,
          totalMcpChars: result.totalMcpChars,
        },
      ]),
    ),
  };
}

export function compareMcpBaseline(
  currentResults: BenchmarkResult[],
  baseline: McpBaseline,
): RegressionFailure[] {
  const failures: RegressionFailure[] = [];
  const currentById = new Map(
    currentResults.map((result) => [result.id, result]),
  );

  for (const [caseId, baselineCase] of Object.entries(baseline.cases)) {
    const currentCase = currentById.get(caseId);
    if (!currentCase) {
      failures.push({
        caseId,
        metric: 'case',
        baseline: 'present',
        current: 'missing',
      });
      continue;
    }

    compareEqual(failures, caseId, 'signal total', {
      baseline: baselineCase.signalTotal,
      current: currentCase.signalTotal,
    });
    compareEqual(failures, caseId, 'related file total', {
      baseline: baselineCase.relatedFileTotal,
      current: currentCase.relatedFileTotal,
    });
    compareEqual(failures, caseId, 'error code total', {
      baseline: baselineCase.errorCodeTotal,
      current: currentCase.errorCodeTotal,
    });
    compareAtLeast(failures, caseId, 'signal matches', {
      baseline: baselineCase.signalMatched,
      current: currentCase.signalMatched,
    });
    compareAtLeast(failures, caseId, 'related file matches', {
      baseline: baselineCase.relatedFileMatched,
      current: currentCase.relatedFileMatched,
    });
    compareAtLeast(failures, caseId, 'error code matches', {
      baseline: baselineCase.errorCodeMatched,
      current: currentCase.errorCodeMatched,
    });
    compareAtMost(failures, caseId, 'tool calls', {
      baseline: baselineCase.toolCalls,
      current: currentCase.toolCalls,
    });
  }

  for (const currentCase of currentResults) {
    if (!baseline.cases[currentCase.id]) {
      failures.push({
        caseId: currentCase.id,
        metric: 'case',
        baseline: 'missing',
        current: 'present',
      });
    }
  }

  return failures;
}

function compareEqual(
  failures: RegressionFailure[],
  caseId: string,
  metric: string,
  values: { baseline: number; current: number },
): void {
  if (values.current !== values.baseline) {
    failures.push({
      caseId,
      metric,
      baseline: values.baseline,
      current: values.current,
    });
  }
}

function compareAtLeast(
  failures: RegressionFailure[],
  caseId: string,
  metric: string,
  values: { baseline: number; current: number },
): void {
  if (values.current < values.baseline) {
    failures.push({
      caseId,
      metric,
      baseline: `>= ${values.baseline}`,
      current: values.current,
    });
  }
}

function compareAtMost(
  failures: RegressionFailure[],
  caseId: string,
  metric: string,
  values: { baseline: number; current: number },
): void {
  if (values.current > values.baseline) {
    failures.push({
      caseId,
      metric,
      baseline: `<= ${values.baseline}`,
      current: values.current,
    });
  }
}
