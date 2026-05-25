import fs from 'node:fs/promises';
import path from 'node:path';
import { getLatestFailureBrief } from '../packages/mcp/src/tools/get-latest-failure-brief.js';
import { queryFailureEvidence } from '../packages/mcp/src/tools/query-failure-evidence.js';

interface BenchmarkResult {
  id: string;
  rawChars: number;
  briefChars: number;
  evidenceChars: number;
  totalMcpChars: number;
  briefRatio: number;
  totalMcpRatio: number;
  reductionRate: number;
  toolCalls: number;
  confidence?: number;
  status: 'pass' | 'warn';
  notes: string[];
}

const DEFAULT_CASES_DIR = 'benchmarks/failures';
const DEFAULT_MARKDOWN_OUT = 'benchmarks/reports/report.md';
const DEFAULT_MAX_BRIEF_RATIO = 0.25;
const DEFAULT_MAX_TOTAL_MCP_RATIO = 0.35;
const DEFAULT_MAX_EVIDENCE_CALLS = 1;

function parseArgs(argv: string[]): {
  casesDir: string;
  markdownOut: string;
} {
  let casesDir = DEFAULT_CASES_DIR;
  let markdownOut = DEFAULT_MARKDOWN_OUT;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--cases') {
      casesDir = argv[index + 1] ?? casesDir;
      index += 1;
      continue;
    }
    if (arg === '--out') {
      markdownOut = argv[index + 1] ?? markdownOut;
      index += 1;
    }
  }

  return {
    casesDir,
    markdownOut,
  };
}

function jsonChars(value: unknown): number {
  return JSON.stringify(value).length;
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return numerator / denominator;
}

function formatKb(chars: number): string {
  return (chars / 1024).toFixed(1);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function markdownEscape(value: string | undefined): string {
  return (value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

async function listCaseDirs(casesDir: string): Promise<string[]> {
  const entries = await fs.readdir(casesDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(casesDir, entry.name))
    .sort();
}

function evaluateStatus(params: {
  briefRatio: number;
  totalMcpRatio: number;
  evidenceCalls: number;
}): { status: BenchmarkResult['status']; notes: string[] } {
  const notes: string[] = [];

  if (params.briefRatio > DEFAULT_MAX_BRIEF_RATIO) {
    notes.push(
      `brief ratio ${formatPercent(params.briefRatio)} > ${formatPercent(DEFAULT_MAX_BRIEF_RATIO)}`,
    );
  }
  if (params.totalMcpRatio > DEFAULT_MAX_TOTAL_MCP_RATIO) {
    notes.push(
      `total MCP ratio ${formatPercent(params.totalMcpRatio)} > ${formatPercent(DEFAULT_MAX_TOTAL_MCP_RATIO)}`,
    );
  }
  if (params.evidenceCalls > DEFAULT_MAX_EVIDENCE_CALLS) {
    notes.push(
      `evidence calls ${params.evidenceCalls} > ${DEFAULT_MAX_EVIDENCE_CALLS}`,
    );
  }

  return {
    status: notes.length === 0 ? 'pass' : 'warn',
    notes,
  };
}

function buildCompressedMarkdown(params: {
  result: BenchmarkResult;
  brief: Awaited<ReturnType<typeof getLatestFailureBrief>>;
  evidence: Awaited<ReturnType<typeof queryFailureEvidence>> | undefined;
}): string {
  const { result, brief, evidence } = params;
  return [
    '# Compressed MCP Result',
    '',
    `- Case: ${result.id}`,
    `- Raw chars: ${result.rawChars}`,
    `- Brief chars: ${result.briefChars}`,
    `- Evidence chars: ${result.evidenceChars}`,
    `- Total MCP chars: ${result.totalMcpChars}`,
    `- Reduction: ${formatPercent(result.reductionRate)}`,
    `- Tool calls: ${result.toolCalls}`,
    `- Confidence: ${result.confidence?.toFixed(2) ?? 'n/a'}`,
    `- Status: ${result.status}`,
    `- Notes: ${result.notes.join('; ') || '-'}`,
    '',
    '## Brief',
    '',
    '```json',
    JSON.stringify(brief, null, 2),
    '```',
    '',
    '## Evidence',
    '',
    evidence
      ? ['```json', JSON.stringify(evidence, null, 2), '```'].join('\n')
      : 'No evidence query was needed.',
    '',
  ].join('\n');
}

async function runCase(caseDir: string): Promise<BenchmarkResult> {
  const id = path.basename(caseDir);
  const rawLog = await fs.readFile(path.join(caseDir, 'raw.log'), 'utf8');
  const rawChars = rawLog.length;

  const brief = await getLatestFailureBrief({
    command: {
      raw: 'unknown command',
      cwd: '/repo',
      shell: 'unknown',
      exitCode: 1,
    },
    logs: {
      stdout: '',
      stderr: rawLog,
    },
  });
  const briefChars = jsonChars(brief);
  let evidence: Awaited<ReturnType<typeof queryFailureEvidence>> | undefined;
  let evidenceCalls = 0;

  if (
    brief.ok &&
    brief.sessionId &&
    brief.next?.recommendedTool === 'e2f_query_failure_evidence'
  ) {
    evidenceCalls = 1;
    evidence = await queryFailureEvidence({
      sessionId: brief.sessionId,
      focus: {
        evidenceIds: brief.diagnosis?.evidence.map((item) => item.id),
        keywords: brief.next.suggestedQueries,
        files: brief.diagnosis?.files,
      },
      maxSections: 3,
      maxCharsPerSection: 1200,
    });
  }

  const evidenceChars = evidence ? jsonChars(evidence) : 0;
  const totalMcpChars = briefChars + evidenceChars;
  const briefRatio = ratio(briefChars, rawChars);
  const totalMcpRatio = ratio(totalMcpChars, rawChars);
  const status = evaluateStatus({
    briefRatio,
    totalMcpRatio,
    evidenceCalls,
  });
  const result: BenchmarkResult = {
    id,
    rawChars,
    briefChars,
    evidenceChars,
    totalMcpChars,
    briefRatio,
    totalMcpRatio,
    reductionRate: 1 - totalMcpRatio,
    toolCalls: 1 + evidenceCalls,
    confidence: brief.diagnosis?.confidence,
    status: status.status,
    notes: status.notes,
  };

  await fs.writeFile(
    path.join(caseDir, 'compressed.md'),
    buildCompressedMarkdown({ result, brief, evidence }),
    'utf8',
  );

  return result;
}

function buildMarkdown(results: BenchmarkResult[]): string {
  const caseCount = results.length;
  const passCount = results.filter((result) => result.status === 'pass').length;
  const averageReduction =
    results.reduce((sum, result) => sum + result.reductionRate, 0) /
    Math.max(1, caseCount);
  const averageTotalRatio =
    results.reduce((sum, result) => sum + result.totalMcpRatio, 0) /
    Math.max(1, caseCount);

  const rows = results.map(
    (result) =>
      `| ${[
        markdownEscape(result.id),
        formatKb(result.rawChars),
        formatKb(result.briefChars),
        formatKb(result.evidenceChars),
        formatKb(result.totalMcpChars),
        formatPercent(result.reductionRate),
        String(result.toolCalls),
        result.confidence?.toFixed(2) ?? 'n/a',
        result.status,
        markdownEscape(result.notes.join('; ') || '-'),
      ].join(' | ')} |`,
  );

  return [
    '# MCP Benchmark Report',
    '',
    `- Cases: ${caseCount}`,
    `- Passing: ${passCount}/${caseCount}`,
    `- Average reduction: ${formatPercent(averageReduction)}`,
    `- Average total MCP ratio: ${formatPercent(averageTotalRatio)}`,
    '',
    '| Case | Raw KB | Brief KB | Evidence KB | Total MCP KB | Reduction | Tool Calls | Confidence | Status | Notes |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---|---|',
    ...rows,
    '',
  ].join('\n');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const caseDirs = await listCaseDirs(args.casesDir);
  const results: BenchmarkResult[] = [];

  for (const caseDir of caseDirs) {
    results.push(await runCase(caseDir));
  }

  await fs.mkdir(path.dirname(args.markdownOut), { recursive: true });
  await fs.writeFile(args.markdownOut, buildMarkdown(results), 'utf8');

  console.log(`Wrote ${args.markdownOut}`);
  console.log(`Wrote compressed.md for ${results.length} benchmark case(s)`);
}

await main();
