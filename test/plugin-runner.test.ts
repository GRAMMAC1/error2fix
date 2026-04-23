import { describe, expect, it } from 'vitest';
import type { ProjectContext } from '../packages/core/src/context/project.js';
import {
  aggregateCoreAnalysis,
  buildCoreAnalysisInput,
  getDefaultPluginRegistry,
  runPlugins,
} from '../packages/core/src/index.js';
import type { LatestRawCapture } from '../packages/core/src/types.js';

describe('plugin runner', () => {
  it('matches built-in plugins against ranked log signals and aggregates results', async () => {
    const capture: LatestRawCapture = {
      metadata: {
        command: 'pnpm build',
        exitCode: 1,
        cwd: '/repo/app',
        shell: 'zsh',
        timestamp: '2026-04-23T12:00:00.000Z',
      },
      stdout: '',
      stderr: [
        'Build failed',
        '',
        "src/app.ts:14:7 - error TS2322: Type 'string' is not assignable to type 'number'",
        'at build (/repo/app/src/app.ts:14:7)',
      ].join('\n'),
      stdoutLogFile: '/tmp/latest.stdout.log',
      stderrLogFile: '/tmp/latest.stderr.log',
    };
    const context: ProjectContext = {
      cwd: '/repo/app',
      packageJson: {
        name: 'demo-app',
        private: true,
        packageManager: 'pnpm@10.6.2',
        scripts: {
          build: 'vite build',
        },
        dependencies: ['react'],
        devDependencies: ['typescript'],
      },
      lockfiles: ['pnpm-lock.yaml'],
      tsconfig: {
        exists: true,
        compilerOptions: {
          strict: true,
        },
      },
      configFiles: ['tsconfig.json', 'vite.config.ts'],
      framework: 'react',
      projectType: 'react',
      gitBranch: 'main',
    };

    const input = buildCoreAnalysisInput(capture, context);
    const pluginResults = await runPlugins(input, getDefaultPluginRegistry());
    const analysis = aggregateCoreAnalysis(input, pluginResults);

    expect(
      pluginResults.some(
        (result) => result.plugin === 'builtin-typescript' && result.matched,
      ),
    ).toBe(true);
    expect(analysis.host.shell).toBe('zsh');
    expect(analysis.host.os.platform.length).toBeGreaterThan(0);
    expect(analysis.summary).toContain('TypeScript');
    expect(analysis.relatedFiles).toContain('src/app.ts');
    expect(analysis.nextSteps.length).toBeGreaterThan(0);
  });
});
