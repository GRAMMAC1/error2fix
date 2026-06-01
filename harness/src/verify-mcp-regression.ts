import fs from 'node:fs/promises';
import { type McpBaseline, compareMcpBaseline } from './mcp-baseline.js';
import { runMcpHarness } from './mcp-harness.js';

const DEFAULT_BASELINE_PATH = 'harness/baselines/mcp.json';

async function readBaseline(): Promise<McpBaseline> {
  return JSON.parse(
    await fs.readFile(DEFAULT_BASELINE_PATH, 'utf8'),
  ) as McpBaseline;
}

async function main(): Promise<void> {
  const baseline = await readBaseline();
  const { results } = await runMcpHarness();
  const failures = compareMcpBaseline(results, baseline);

  if (failures.length === 0) {
    console.log('MCP harness regression check passed.');
    return;
  }

  console.error('MCP harness regression check failed:');
  for (const failure of failures) {
    console.error(
      `- ${failure.caseId}: ${failure.metric} expected ${failure.baseline}, got ${failure.current}`,
    );
  }
  process.exitCode = 1;
}

await main();
