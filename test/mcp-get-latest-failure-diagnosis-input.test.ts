import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { persistLatestRawCapture } from '../packages/cli/src/capture/store.js';
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

  it('returns aggregated CoreAnalysis for the latest failure session', async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), 'e2f-mcp-full-'));
    cleanup.push(home);
    process.env.HOME = home;

    const projectDir = path.join(home, 'project');
    await fs.mkdir(projectDir, { recursive: true });
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
    const paths = getE2FPaths(path.join(home, '.e2f'));
    await fs.mkdir(paths.logsDir, { recursive: true });
    const stdoutLogFile = path.join(paths.logsDir, 'capture.stdout.log');
    const stderrLogFile = path.join(paths.logsDir, 'capture.stderr.log');
    await fs.writeFile(stdoutLogFile, '', 'utf8');
    await fs.writeFile(
      stderrLogFile,
      "src/app.ts:14:7 - error TS2322: Type 'string' is not assignable to type 'number'\n",
      'utf8',
    );

    await persistLatestRawCapture({
      command: 'pnpm build',
      exitCode: 1,
      cwd: projectDir,
      shell: 'zsh',
      timestamp: '2026-04-21T12:00:00.000Z',
      stderrLogFile,
    });

    const result = await getLatestFailureDiagnosisInput({});
    expect(() =>
      getLatestFailureDiagnosisInputResultSchema.parse(result),
    ).not.toThrow();
    expect(result.ok).toBe(true);
    const analysis = result.data as {
      summary: string;
      keySnippet?: string;
      relatedFiles: string[];
      likelyCauses: string[];
    };
    expect(analysis.summary.length).toBeGreaterThan(0);
    expect(analysis.keySnippet).toContain('TS2322');
    expect(analysis.relatedFiles).toContain('src/app.ts');
    expect(analysis.likelyCauses.length).toBeGreaterThan(0);
  });
});
