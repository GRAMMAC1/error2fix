import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  loadLatestRawCapture,
  persistLatestRawCapture,
} from '../packages/core/src/capture/store.js';
import { buildSession } from '../packages/core/src/session/capture.js';
import {
  ensureE2FDirs,
  loadCapturedOutput,
} from '../packages/core/src/session/store.js';
import { getE2FPaths } from '../packages/core/src/utils/paths.js';

async function makeTempPaths() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'e2f-test-'));
  return getE2FPaths(tempDir);
}

describe('session store', () => {
  const cleanup: string[] = [];

  afterEach(async () => {
    await Promise.all(
      cleanup
        .splice(0)
        .map((entry) => fs.rm(entry, { recursive: true, force: true })),
    );
  });

  it('persists latest raw capture logs for later analysis', async () => {
    const paths = await makeTempPaths();
    cleanup.push(paths.homeDir);
    await ensureE2FDirs(paths);

    const stdoutLogFile = path.join(paths.logsDir, 'capture.stdout.log');
    const stderrLogFile = path.join(paths.logsDir, 'capture.stderr.log');
    await fs.writeFile(stdoutLogFile, 'building project...\n', 'utf8');
    await fs.writeFile(
      stderrLogFile,
      "src/app.ts:14:7 - error TS2322: Type 'string' is not assignable to type 'number'\n",
      'utf8',
    );

    await persistLatestRawCapture(
      {
        command: 'pnpm build',
        exitCode: 1,
        cwd: '/tmp/project',
        shell: 'zsh',
        timestamp: '2026-04-21T12:10:00.000Z',
        stdoutLogFile,
        stderrLogFile,
      },
      paths,
    );

    const latest = await loadLatestRawCapture(paths);
    expect(latest?.metadata.command).toBe('pnpm build');
    expect(latest?.metadata.exitCode).toBe(1);
    expect(latest?.stdoutLogFile).toBe(paths.latestStdoutLogFile);
    expect(latest?.stderrLogFile).toBe(paths.latestStderrLogFile);
    expect(latest?.stderr).toContain('TS2322');

    const session = buildSession({
      command: latest!.metadata.command,
      exitCode: latest!.metadata.exitCode,
      cwd: latest!.metadata.cwd,
      shell: latest!.metadata.shell,
      timestamp: latest!.metadata.timestamp,
      stdoutLogFile: latest!.stdoutLogFile,
      stderrLogFile: latest!.stderrLogFile,
    });
    const output = await loadCapturedOutput(session);
    expect(output.stderr).toContain('TS2322');
    expect(output.stdout).toContain('building project');
    expect(output.combined).toContain('TS2322');
  });
});
