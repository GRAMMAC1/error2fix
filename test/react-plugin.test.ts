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

async function analyzeReact(stderr: string) {
  const input = await buildCoreAnalysisInput(makeCapture(stderr));
  const pluginResults = await runPlugins(input, getDefaultPluginRegistry());
  const reactResult = pluginResults.find(
    (result) => result.plugin === 'builtin-react',
  );
  const typeScriptResult = pluginResults.find(
    (result) => result.plugin === 'builtin-typescript',
  );
  return {
    analysis: aggregateCoreAnalysis(input, pluginResults),
    reactResult,
    typeScriptResult,
  };
}

describe('React plugin', () => {
  it('detects invalid hook calls without routing runtime errors through TypeScript', async () => {
    const { analysis, reactResult, typeScriptResult } = await analyzeReact(
      [
        'Error: Invalid hook call. Hooks can only be called inside of the body of a function component.',
        '    at useUser (src/components/UserCard.tsx:12:3)',
        '    at renderWithHooks (node_modules/react-dom/cjs/react-dom.development.js:16305:18)',
      ].join('\n'),
    );
    const data = reactResult?.data as
      | {
          diagnostics: Array<{ kind: string; file?: string }>;
          failureKinds: string[];
        }
      | undefined;

    expect(typeScriptResult?.matched).toBe(false);
    expect(reactResult?.matched).toBe(true);
    expect(analysis.summary).toContain('React hook rule');
    expect(analysis.relatedFiles).toContain('src/components/UserCard.tsx');
    expect(data?.diagnostics[0]).toMatchObject({
      kind: 'hook_rule',
      file: 'src/components/UserCard.tsx',
    });
    expect(data?.failureKinds).toContain('hook_rule');
  });

  it('classifies Next hydration mismatches and keeps the app route file', async () => {
    const { analysis, reactResult } = await analyzeReact(
      [
        "Error: Hydration failed because the server rendered HTML didn't match the client.",
        '    at Home (src/app/page.tsx:8:5)',
      ].join('\n'),
    );
    const data = reactResult?.data as
      | {
          diagnostics: Array<{ kind: string; file?: string }>;
        }
      | undefined;

    expect(reactResult?.matched).toBe(true);
    expect(analysis.summary).toContain('hydration mismatch');
    expect(analysis.relatedFiles).toContain('src/app/page.tsx');
    expect(data?.diagnostics[0]).toMatchObject({
      kind: 'hydration_mismatch',
      file: 'src/app/page.tsx',
    });
  });

  it('identifies Next server/client component boundary failures', async () => {
    const { analysis, reactResult } = await analyzeReact(
      [
        'ReactServerComponentsError: You\'re importing a component that needs useState. It only works in a Client Component but none of its parents are marked with "use client".',
        './src/app/page.tsx',
      ].join('\n'),
    );
    const data = reactResult?.data as
      | {
          diagnostics: Array<{ kind: string }>;
        }
      | undefined;

    expect(reactResult?.matched).toBe(true);
    expect(analysis.summary).toContain('server client boundary');
    expect(analysis.relatedFiles).toContain('./src/app/page.tsx');
    expect(data?.diagnostics[0]).toMatchObject({
      kind: 'server_client_boundary',
    });
    expect(reactResult?.suggestions?.join(' ')).toContain('use client');
  });
});
