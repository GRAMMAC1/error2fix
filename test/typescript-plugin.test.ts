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
  const typeScriptResult = pluginResults.find(
    (result) => result.plugin === 'builtin-typescript',
  );
  return {
    analysis: aggregateCoreAnalysis(input, pluginResults),
    typeScriptResult,
  };
}

describe('TypeScript plugin', () => {
  it('extracts module-resolution diagnostics with file location and focused guidance', async () => {
    const { analysis, typeScriptResult } = await analyzeTypeScript(
      [
        'vite build failed',
        "src/routes/App.tsx:8:22 - error TS2307: Cannot find module '@app/widgets' or its corresponding type declarations.",
        "8 import { Widget } from '@app/widgets';",
        '                       ~~~~~~~~~~~~~~',
      ].join('\n'),
    );
    const data = typeScriptResult?.data as
      | {
          diagnostics: Array<{
            code: string;
            kind: string;
            file?: string;
            line?: number;
            column?: number;
          }>;
        }
      | undefined;

    expect(typeScriptResult?.matched).toBe(true);
    expect(analysis.summary).toContain('TS2307');
    expect(analysis.summary).toContain('src/routes/App.tsx:8:22');
    expect(analysis.relatedFiles).toContain('src/routes/App.tsx');
    expect(data?.diagnostics[0]).toMatchObject({
      code: 'TS2307',
      kind: 'module_resolution',
      file: 'src/routes/App.tsx',
      line: 8,
      column: 22,
    });
    expect(typeScriptResult?.suggestions?.join(' ')).toContain('import path');
  });

  it('classifies assignability diagnostics from parenthesized locations', async () => {
    const { analysis, typeScriptResult } = await analyzeTypeScript(
      [
        "src/components/Counter.tsx(14,7): error TS2322: Type 'string' is not assignable to type 'number'.",
        '  const count: number = label;',
        '        ~~~~~',
      ].join('\n'),
    );
    const data = typeScriptResult?.data as
      | {
          diagnostics: Array<{ code: string; kind: string; file?: string }>;
          failureKinds: string[];
        }
      | undefined;

    expect(analysis.summary).toContain('TypeScript TS2322');
    expect(analysis.summary).toContain('src/components/Counter.tsx:14:7');
    expect(data?.diagnostics[0]).toMatchObject({
      code: 'TS2322',
      kind: 'type_assignability',
      file: 'src/components/Counter.tsx',
    });
    expect(data?.failureKinds).toContain('type_assignability');
  });

  it('keeps vue-tsc diagnostics tied to Vue SFC files', async () => {
    const { analysis, typeScriptResult } = await analyzeTypeScript(
      [
        'vue-tsc --noEmit',
        "src/components/UserCard.vue:42:18 - error TS2339: Property 'profileUrl' does not exist on type 'User'.",
      ].join('\n'),
    );
    const data = typeScriptResult?.data as
      | {
          diagnostics: Array<{ code: string; kind: string; file?: string }>;
        }
      | undefined;

    expect(typeScriptResult?.matched).toBe(true);
    expect(analysis.summary).toContain('TS2339');
    expect(analysis.relatedFiles).toContain('src/components/UserCard.vue');
    expect(data?.diagnostics[0]).toMatchObject({
      code: 'TS2339',
      kind: 'missing_property',
      file: 'src/components/UserCard.vue',
    });
  });
});
