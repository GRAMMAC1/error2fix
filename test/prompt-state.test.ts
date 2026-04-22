import { describe, expect, it } from 'vitest';
import {
  buildPromptState,
  extractKeywords,
  extractRelatedFiles,
  extractStackLines,
} from '../packages/core/src/prompt/state.js';
import type {
  FailureSession,
  ProjectContext,
} from '../packages/core/src/types.js';

describe('prompt state', () => {
  it('extracts files, keywords, and stack lines from error text', () => {
    const errorText = [
      "src/app.ts:14:7 - error TS2322: Type 'string' is not assignable to type 'number'",
      'at build (/repo/src/app.ts:14:7)',
      'ERR_PNPM_NO_SCRIPT Missing script: build',
    ].join('\n');

    expect(extractRelatedFiles(errorText)).toContain('src/app.ts');
    expect(extractKeywords(errorText)).toEqual(
      expect.arrayContaining(['TS2322', 'ERR_PNPM_NO_SCRIPT']),
    );
    expect(extractStackLines(errorText)).toEqual(
      expect.arrayContaining([
        "src/app.ts:14:7 - error TS2322: Type 'string' is not assignable to type 'number'",
        'at build (/repo/src/app.ts:14:7)',
      ]),
    );
  });

  it('builds minimal prompt state from session and context', () => {
    const session: FailureSession = {
      id: 'session-1',
      command: 'pnpm build',
      exitCode: 1,
      cwd: '/tmp/project',
      shell: 'zsh',
      timestamp: '2026-04-21T12:00:00.000Z',
      stdoutSnippet: '',
      stderrSnippet:
        "src/app.ts:14:7 - error TS2322: Type 'string' is not assignable to type 'number'",
      projectType: 'react',
      env: {
        os: 'darwin',
        nodeVersion: 'v24.0.0',
        packageManager: 'pnpm',
      },
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

    const state = buildPromptState(session, context, {
      category: 'typescript_error',
      summary: 'Build failed during TypeScript compilation.',
      errorText: session.stderrSnippet,
    });

    expect(state.command.raw).toBe('pnpm build');
    expect(state.host?.runtime).toEqual(
      expect.arrayContaining(['node@24.0.0', 'pnpm@10']),
    );
    expect(state.failure.category).toBe('compile');
    expect(state.error.files).toContain('src/app.ts');
    expect(state.goal.ask).toContain('files_to_inspect');
  });
});
