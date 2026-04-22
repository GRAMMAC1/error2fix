import { describe, expect, it } from 'vitest';
import { buildDiagnosis } from '../packages/core/src/prompt/generator.js';
import type {
  FailureSession,
  ProjectContext,
} from '../packages/core/src/types.js';

describe('prompt generation', () => {
  it('includes command, framework, and requested output sections', () => {
    const session: FailureSession = {
      id: 'session-1',
      command: 'npm run build',
      exitCode: 1,
      cwd: '/tmp/project',
      shell: 'zsh',
      timestamp: '2026-04-21T12:00:00.000Z',
      stdoutSnippet: '',
      stderrSnippet: '',
      projectType: 'nextjs',
      env: {
        os: 'darwin',
        nodeVersion: 'v24.0.0',
        packageManager: 'npm',
      },
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
    const diagnosis = buildDiagnosis(
      session,
      context,
      'build_failure',
      'Build failed during compilation.',
      'src/app.ts:14:7 - error TS2322: Build error',
    );
    expect(diagnosis.prompt).toContain('Raw command: npm run build');
    expect(diagnosis.prompt).toContain('Runtime/tools: node@24.0.0, npm@11');
    expect(diagnosis.prompt).toContain('Related files:');
    expect(diagnosis.prompt).toContain('1. Root cause');
    expect(diagnosis.promptState.error.files).toContain('src/app.ts');
  });
});
