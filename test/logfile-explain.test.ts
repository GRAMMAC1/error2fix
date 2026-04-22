import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { explainLogFile } from '../packages/cli/src/commands/explain.js';

describe('explainLogFile', () => {
  const cleanup: string[] = [];

  afterEach(async () => {
    await Promise.all(
      cleanup
        .splice(0)
        .map((entry) => fs.rm(entry, { recursive: true, force: true })),
    );
  });

  it('parses a TypeScript log file into a diagnosis', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'e2f-log-'));
    cleanup.push(cwd);
    await fs.writeFile(
      path.join(cwd, 'build.log'),
      "src/app.ts:14:7 - error TS2322: Type 'string' is not assignable to type 'number'\n",
    );
    const result = await explainLogFile(path.join(cwd, 'build.log'));
    expect(result.diagnosis.category).toBe('typescript_error');
    expect(result.diagnosis.keyErrorSnippet).toContain('TS2322');
  });
});
