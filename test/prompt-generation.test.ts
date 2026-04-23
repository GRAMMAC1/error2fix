import { describe, expect, it } from 'vitest';
import {
  aggregateCoreAnalysis,
  buildCoreAnalysisInput,
  buildPrompt,
  buildPromptState,
  getDefaultPluginRegistry,
  runPlugins,
} from '../packages/core/src/index.js';
import type {
  LatestRawCapture,
  ProjectContext,
} from '../packages/core/src/types.js';

describe('prompt generation', () => {
  it('includes command, workspace, plugin context, and requested output sections', async () => {
    const capture: LatestRawCapture = {
      metadata: {
        command: 'npm run build',
        exitCode: 1,
        cwd: '/tmp/project',
        shell: 'zsh',
        timestamp: '2026-04-21T12:00:00.000Z',
      },
      stdout: '',
      stderr:
        'src/app.ts:14:7 - error TS2322: Build error\nat build (/tmp/project/src/app.ts:14:7)\n',
      stdoutLogFile: '/tmp/stdout.log',
      stderrLogFile: '/tmp/stderr.log',
    };
    const context: ProjectContext = {
      cwd: '/tmp/project',
      packageJson: {
        name: 'demo',
        private: true,
        packageManager: 'npm@11',
        scripts: { build: 'next build' },
        dependencies: ['next', 'react'],
        devDependencies: ['typescript'],
      },
      lockfiles: ['package-lock.json'],
      tsconfig: {
        exists: true,
        compilerOptions: { strict: true, jsx: 'preserve' },
      },
      configFiles: ['next.config.js', 'tsconfig.json'],
      framework: 'nextjs',
      projectType: 'nextjs',
      gitBranch: 'main',
    };

    const input = buildCoreAnalysisInput(capture, context);
    const pluginResults = await runPlugins(input, getDefaultPluginRegistry());
    const analysis = aggregateCoreAnalysis(input, pluginResults);
    const prompt = buildPrompt(buildPromptState(input, analysis));

    expect(prompt).toContain('Raw command: npm run build');
    expect(prompt).toContain('Workspace:');
    expect(prompt).toContain('Plugin context:');
    expect(prompt).toContain('builtin-typescript');
    expect(prompt).toContain('1. Root cause');
    expect(prompt).toContain('src/app.ts');
  });
});
