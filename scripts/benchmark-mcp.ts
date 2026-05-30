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
  signalMatched: number;
  signalTotal: number;
  signalHit: string;
  relatedFileHit: string;
  errorCodeHit: string;
}

interface ExpectedSignals {
  signals?: string[];
  relatedFiles?: string[];
  errorCodes?: string[];
}

interface HitResult {
  matched: number;
  total: number;
  missing: string[];
}

const DEFAULT_CASES_DIR = 'benchmarks/failures';
const DEFAULT_MARKDOWN_OUT = 'benchmarks/reports/report.md';

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

async function readJsonIfPresent<T>(filePath: string): Promise<T | undefined> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

async function listCaseDirs(casesDir: string): Promise<string[]> {
  const entries = await fs.readdir(casesDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(casesDir, entry.name))
    .sort();
}

function checkTerms(terms: string[] | undefined, haystack: string): HitResult {
  const expectedTerms = terms ?? [];
  const lowerHaystack = haystack.toLowerCase();
  const missing = expectedTerms.filter(
    (term) => !lowerHaystack.includes(term.toLowerCase()),
  );
  return {
    matched: expectedTerms.length - missing.length,
    total: expectedTerms.length,
    missing,
  };
}

function formatHit(result: HitResult): string {
  if (result.total === 0) {
    return 'n/a';
  }
  return `${result.matched}/${result.total}`;
}

function buildCompressedMarkdown(params: {
  result: BenchmarkResult;
  brief: Awaited<ReturnType<typeof getLatestFailureBrief>>;
  evidence: Awaited<ReturnType<typeof queryFailureEvidence>> | undefined;
  expected: ExpectedSignals | undefined;
  hits: {
    signals: HitResult;
    relatedFiles: HitResult;
    errorCodes: HitResult;
  };
}): string {
  const { result, brief, evidence, expected, hits } = params;
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
    `- Signal hit: ${result.signalHit}`,
    `- Related file hit: ${result.relatedFileHit}`,
    `- Error code hit: ${result.errorCodeHit}`,
    '',
    '## Missing Expected Signals',
    '',
    `- Signals: ${hits.signals.missing.join(', ') || '-'}`,
    `- Related files: ${hits.relatedFiles.missing.join(', ') || '-'}`,
    `- Error codes: ${hits.errorCodes.missing.join(', ') || '-'}`,
    '',
    '## Expected',
    '',
    expected
      ? ['```json', JSON.stringify(expected, null, 2), '```'].join('\n')
      : 'No expected signals were provided.',
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
  const expected = await readJsonIfPresent<ExpectedSignals>(
    path.join(caseDir, 'expect.json'),
  );
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
  const structuredOutput = { brief, evidence };
  const searchableOutput = JSON.stringify(structuredOutput);
  const hits = {
    signals: checkTerms(expected?.signals, searchableOutput),
    relatedFiles: checkTerms(expected?.relatedFiles, searchableOutput),
    errorCodes: checkTerms(expected?.errorCodes, searchableOutput),
  };
  const briefRatio = ratio(briefChars, rawChars);
  const totalMcpRatio = ratio(totalMcpChars, rawChars);
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
    confidence: brief.diagnosis?.confidence ?? brief.confidence,
    signalMatched: hits.signals.matched,
    signalTotal: hits.signals.total,
    signalHit: formatHit(hits.signals),
    relatedFileHit: formatHit(hits.relatedFiles),
    errorCodeHit: formatHit(hits.errorCodes),
  };

  await fs.writeFile(
    path.join(caseDir, 'debug.json'),
    `${JSON.stringify({ expected, hits, result, ...structuredOutput }, null, 2)}\n`,
    'utf8',
  );
  await fs.writeFile(
    path.join(caseDir, 'compressed.md'),
    buildCompressedMarkdown({ result, brief, evidence, expected, hits }),
    'utf8',
  );

  return result;
}

function buildMarkdown(results: BenchmarkResult[]): string {
  const caseCount = results.length;
  const signalMatched = results.reduce(
    (sum, result) => sum + result.signalMatched,
    0,
  );
  const signalTotal = results.reduce(
    (sum, result) => sum + result.signalTotal,
    0,
  );
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
        result.signalHit,
        result.relatedFileHit,
        result.errorCodeHit,
      ].join(' | ')} |`,
  );

  return [
    '# MCP Benchmark Report',
    '',
    `- Cases: ${caseCount}`,
    `- Signal matches: ${signalMatched}/${signalTotal}`,
    `- Average reduction: ${formatPercent(averageReduction)}`,
    `- Average total MCP ratio: ${formatPercent(averageTotalRatio)}`,
    '',
    '| Case | Raw KB | Brief KB | Evidence KB | Total MCP KB | Reduction | Tool Calls | Confidence | Signal Hit | File Hit | Code Hit |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
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
