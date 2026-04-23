import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildSession,
  captureFailureSession,
} from '../packages/core/src/session/capture.js';
import {
  ensureE2FDirs,
  listSessions,
  loadCapturedOutput,
  loadLatestSession,
  saveSession,
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

  it('writes and loads latest session', async () => {
    const paths = await makeTempPaths();
    cleanup.push(paths.homeDir);
    await ensureE2FDirs(paths);
    const session = buildSession({
      command: 'npm run build',
      exitCode: 1,
      cwd: '/tmp/project',
      shell: 'zsh',
      timestamp: '2026-04-21T12:00:00.000Z',
    });

    await saveSession(session, paths);
    const latest = await loadLatestSession(paths);
    expect(latest?.command).toBe('npm run build');
    expect(latest?.exitCode).toBe(1);
  });

  it('lists sessions in reverse chronological order', async () => {
    const paths = await makeTempPaths();
    cleanup.push(paths.homeDir);
    await ensureE2FDirs(paths);
    const one = buildSession({
      command: 'npm test',
      exitCode: 1,
      cwd: '/tmp/a',
      shell: 'bash',
      timestamp: '2026-04-21T12:00:00.000Z',
    });
    const two = buildSession({
      command: 'pnpm build',
      exitCode: 1,
      cwd: '/tmp/b',
      shell: 'zsh',
      timestamp: '2026-04-21T12:05:00.000Z',
    });

    await saveSession(one, paths);
    await saveSession(two, paths);
    const sessions = await listSessions(10, paths);
    expect(sessions.map((entry) => entry.command)).toEqual([
      'pnpm build',
      'npm test',
    ]);
  });

  it('persists raw log file paths and loads raw output for later analysis', async () => {
    const paths = await makeTempPaths();
    cleanup.push(paths.homeDir);
    await ensureE2FDirs(paths);

    const stdoutLogFile = path.join(paths.logsDir, 'stdout.log');
    const stderrLogFile = path.join(paths.logsDir, 'stderr.log');
    await fs.writeFile(stdoutLogFile, 'building project...\n', 'utf8');
    await fs.writeFile(
      stderrLogFile,
      "src/app.ts:14:7 - error TS2322: Type 'string' is not assignable to type 'number'\n",
      'utf8',
    );

    await captureFailureSession(
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

    const latest = await loadLatestSession(paths);
    expect(latest?.stdoutLogFile).toBe(stdoutLogFile);
    expect(latest?.stderrLogFile).toBe(stderrLogFile);
    expect(latest?.stderrSnippet).toContain('TS2322');

    const output = await loadCapturedOutput(latest!);
    expect(output.stderr).toContain('TS2322');
    expect(output.stdout).toContain('building project');
    expect(output.combined).toContain('TS2322');
  });
});
