import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { saveSession } from '../packages/core/src/session/store.js';
import { getE2FPaths } from '../packages/core/src/utils/paths.js';
import {
  getLatestFailureDiagnosisInput,
  getLatestFailureDiagnosisInputResultSchema,
} from '../packages/mcp/src/tools/get-latest-failure-diagnosis-input.js';

describe('get_latest_failure_diagnosis_input', () => {
  const cleanup: string[] = [];
  const originalHome = process.env.HOME;

  afterEach(async () => {
    process.env.HOME = originalHome;
    await Promise.all(
      cleanup
        .splice(0)
        .map((entry) => fs.rm(entry, { recursive: true, force: true })),
    );
  });

  it('returns a stable error object when no latest session exists', async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), 'e2f-mcp-empty-'));
    cleanup.push(home);
    process.env.HOME = home;

    const result = await getLatestFailureDiagnosisInput();
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('NO_FAILURE_SESSION');
  });

  it('returns structured state and prompt for the latest failure session', async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), 'e2f-mcp-full-'));
    cleanup.push(home);
    process.env.HOME = home;

    const projectDir = path.join(home, 'project');
    await fs.mkdir(projectDir, { recursive: true });
    const logsDir = path.join(home, '.e2f', 'logs');
    await fs.mkdir(logsDir, { recursive: true });
    await fs.writeFile(
      path.join(projectDir, 'package.json'),
      JSON.stringify({
        name: 'demo-app',
        packageManager: 'pnpm@10.6.2',
        scripts: {
          build: 'vite build',
        },
        dependencies: {
          vite: '^6.0.0',
        },
      }),
      'utf8',
    );
    const stderrLogFile = path.join(logsDir, 'latest.stderr.log');
    await fs.writeFile(
      stderrLogFile,
      "src/app.ts:14:7 - error TS2322: Type 'string' is not assignable to type 'number'\n",
      'utf8',
    );

    const paths = getE2FPaths(path.join(home, '.e2f'));
    await saveSession(
      {
        id: 'session-1',
        command: 'pnpm build',
        exitCode: 1,
        cwd: projectDir,
        shell: 'zsh',
        timestamp: '2026-04-21T12:00:00.000Z',
        stdoutSnippet: '',
        stderrSnippet: '',
        stderrLogFile,
        projectType: 'vite',
        env: {
          os: 'darwin 24.6.0',
          nodeVersion: 'v24.14.0',
          packageManager: 'pnpm@10.6.2',
        },
      },
      paths,
    );

    const result = await getLatestFailureDiagnosisInput({ format: 'both' });
    expect(() =>
      getLatestFailureDiagnosisInputResultSchema.parse(result),
    ).not.toThrow();
    expect(result.ok).toBe(true);
    expect(result.data?.format).toBe('both');
    expect(result.data?.state?.command.raw).toBe('pnpm build');
    expect(result.data?.state?.error.keywords).toContain('TS2322');
    expect(result.data?.prompt).toContain(
      'You are diagnosing a failed developer terminal command.',
    );
  });
});
