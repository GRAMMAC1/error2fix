import fs from 'node:fs/promises';
import path from 'node:path';
import { buildMcpBaseline } from './mcp-baseline.js';
import { runMcpHarness } from './mcp-harness.js';

const DEFAULT_BASELINE_OUT = 'harness/baselines/mcp.json';

async function main(): Promise<void> {
  const { results } = await runMcpHarness();
  const baseline = buildMcpBaseline(results);

  await fs.mkdir(path.dirname(DEFAULT_BASELINE_OUT), { recursive: true });
  await fs.writeFile(
    DEFAULT_BASELINE_OUT,
    `${JSON.stringify(baseline, null, 2)}\n`,
    'utf8',
  );

  console.log(`Updated ${DEFAULT_BASELINE_OUT}`);
}

await main();
