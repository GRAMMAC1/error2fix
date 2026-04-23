import { describe, expect, it } from 'vitest';
import {
  aggregateCoreAnalysis,
  buildCoreAnalysisInput,
  buildPromptState,
  getDefaultPluginRegistry,
  runPlugins,
} from '../packages/core/src/index.js';
import type {
  LatestRawCapture,
  ProjectContext,
} from '../packages/core/src/types.js';

describe('prompt state', () => {
  it('builds prompt state from pluginized analysis input', async () => {
    const capture: LatestRawCapture = {
      metadata: {
        command: 'pnpm build',
        exitCode: 1,
        cwd: '/tmp/project',
        shell: 'zsh',
        timestamp: '2026-04-21T12:00:00.000Z',
      },
      stdout: '',
      stderr: [
        "src/app.ts:14:7 - error TS2322: Type 'string' is not assignable to type 'number'",
        'at build (/tmp/project/src/app.ts:14:7)',
      ].join('\n'),
      stdoutLogFile: '/tmp/stdout.log',
      stderrLogFile: '/tmp/stderr.log',
    };
    const context: ProjectContext = {
      cwd: '/tmp/project',
      packageJson: {
        name: 'demo',
        private: true,
        packageManager: 'pnpm@10',
        scripts: { build: 'vite build' },
        dependencies: ['react'],
        devDependencies: ['typescript'],
      },
      lockfiles: ['pnpm-lock.yaml'],
      tsconfig: { exists: true, compilerOptions: { strict: true } },
      configFiles: ['tsconfig.json', 'vite.config.ts'],
      framework: 'react',
      projectType: 'react',
      gitBranch: 'main',
    };

    const input = buildCoreAnalysisInput(capture, context);
    const pluginResults = await runPlugins(input, getDefaultPluginRegistry());
    const analysis = aggregateCoreAnalysis(input, pluginResults);
    const state = buildPromptState(input, analysis);

    expect(state.command.raw).toBe('pnpm build');
    expect(state.host.os.platform.length).toBeGreaterThan(0);
    expect(state.workspace.files).toContain('tsconfig.json');
    expect(state.error.relatedFiles).toContain('src/app.ts');
    expect(
      state.pluginContext.some(
        (entry) => entry.plugin === 'builtin-typescript',
      ),
    ).toBe(true);
    expect(state.goal.ask).toContain('files_to_inspect');
  });
});
