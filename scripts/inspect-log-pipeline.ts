import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  extractSignals,
  normalizeLogs,
  rankSignals,
  segmentLogs,
} from '../packages/core/src/log-parser/index.js';

interface InspectResult {
  file: string;
  normalized: ReturnType<typeof normalizeLogs>;
  segmented: ReturnType<typeof segmentLogs>;
  extracted: ReturnType<typeof extractSignals>;
  ranked: ReturnType<typeof rankSignals>;
}

async function main(): Promise<void> {
  const fileArg =
    process.argv[2] ??
    path.join(process.cwd(), 'samples', 'log-file', 'error.log');
  const absolutePath = path.resolve(fileArg);
  const rawLog = await fs.readFile(absolutePath, 'utf8');

  const normalized = normalizeLogs({
    stdout: '',
    stderr: rawLog,
  });
  const segmented = segmentLogs(normalized);
  const extracted = extractSignals(segmented);
  const ranked = rankSignals(extracted);

  const result: InspectResult = {
    file: absolutePath,
    normalized,
    segmented,
    extracted,
    ranked,
  };

  console.log(JSON.stringify(result, null, 2));
}

await main();
