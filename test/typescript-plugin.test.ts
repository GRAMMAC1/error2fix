import { describe, expect, it } from 'vitest';
import {
  aggregateCoreAnalysis,
  buildCoreAnalysisInput,
  getDefaultPluginRegistry,
  runPlugins,
} from '../packages/core/src/index.js';
import type { LatestRawCapture } from '../packages/core/src/types/metadata.js';

function makeCapture(stderr: string): LatestRawCapture {
  return {
    metadata: {
      command: 'pnpm build',
      exitCode: 1,
      cwd: process.cwd(),
      shell: 'zsh',
      timestamp: '2026-07-07T00:00:00.000Z',
    },
    stdout: '',
    stderr,
    stdoutLogFile: '/tmp/latest.stdout.log',
    stderrLogFile: '/tmp/latest.stderr.log',
  };
}

async function analyzeTypeScript(stderr: string) {
  const input = await buildCoreAnalysisInput(makeCapture(stderr));
  const pluginResults = await runPlugins(input, getDefaultPluginRegistry());
  const compilerResult = pluginResults.find(
    (result) => result.plugin === 'frontend-compiler',
  );
  return {
    analysis: aggregateCoreAnalysis(input, pluginResults),
    compilerResult,
  };
}

describe('frontend compiler diagnostics', () => {
  it('extracts module-resolution diagnostics with file location and focused guidance', async () => {
    const { analysis, compilerResult } = await analyzeTypeScript(
      [
        'vite build failed',
        "src/routes/App.tsx:8:22 - error TS2307: Cannot find module '@app/widgets' or its corresponding type declarations.",
        "8 import { Widget } from '@app/widgets';",
        '                       ~~~~~~~~~~~~~~',
      ].join('\n'),
    );
    const data = compilerResult?.data as
      | {
          evidences: Array<{
            category: string;
            file?: string;
            line?: number;
            column?: number;
            message: string;
          }>;
        }
      | undefined;

    expect(compilerResult?.matched).toBe(true);
    expect(analysis.summary).toContain('TS2307');
    expect(analysis.summary).toContain('src/routes/App.tsx:8:22');
    expect(analysis.relatedFiles).toContain('src/routes/App.tsx');
    expect(data?.evidences[0]).toMatchObject({
      category: 'module_resolution',
      file: 'src/routes/App.tsx',
      line: 8,
      column: 22,
    });
    expect(data?.evidences[0]?.message).toContain('TS2307');
  });

  it('classifies assignability diagnostics from parenthesized locations', async () => {
    const { analysis, compilerResult } = await analyzeTypeScript(
      [
        "src/components/Counter.tsx(14,7): error TS2322: Type 'string' is not assignable to type 'number'.",
        '  const count: number = label;',
        '        ~~~~~',
      ].join('\n'),
    );
    const data = compilerResult?.data as
      | {
          evidences: Array<{
            category: string;
            file?: string;
            message: string;
          }>;
        }
      | undefined;

    expect(analysis.summary).toContain('TS2322');
    expect(analysis.summary).toContain('src/components/Counter.tsx:14:7');
    expect(data?.evidences[0]).toMatchObject({
      category: 'type_assignability',
      file: 'src/components/Counter.tsx',
    });
  });

  it('keeps vue-tsc diagnostics tied to Vue SFC files', async () => {
    const { analysis, compilerResult } = await analyzeTypeScript(
      [
        'vue-tsc --noEmit',
        "src/components/UserCard.vue:42:18 - error TS2339: Property 'profileUrl' does not exist on type 'User'.",
      ].join('\n'),
    );
    const data = compilerResult?.data as
      | {
          evidences: Array<{
            category: string;
            file?: string;
            framework?: string;
            message: string;
          }>;
        }
      | undefined;

    expect(compilerResult?.matched).toBe(true);
    expect(analysis.summary).toContain('TS2339');
    expect(analysis.relatedFiles).toContain('src/components/UserCard.vue');
    expect(data?.evidences[0]).toMatchObject({
      category: 'missing_property',
      framework: 'vue',
      file: 'src/components/UserCard.vue',
    });
  });
});
