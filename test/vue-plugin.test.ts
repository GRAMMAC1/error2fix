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

async function analyzeVue(stderr: string) {
  const input = await buildCoreAnalysisInput(makeCapture(stderr));
  const pluginResults = await runPlugins(input, getDefaultPluginRegistry());
  const compilerResult = pluginResults.find(
    (result) => result.plugin === 'frontend-compiler',
  );
  const runtimeResult = pluginResults.find(
    (result) => result.plugin === 'frontend-runtime',
  );
  return {
    analysis: aggregateCoreAnalysis(input, pluginResults),
    compilerResult,
    runtimeResult,
  };
}

describe('frontend Vue diagnostics', () => {
  it('detects Vue SFC compiler failures from Vite plugin output', async () => {
    const { analysis, compilerResult, runtimeResult } = await analyzeVue(
      [
        '[plugin:vite:vue] [@vue/compiler-sfc] <script setup> cannot contain ES module exports.',
        '/repo/app/src/components/UserCard.vue',
        '12 | export const title = "User"',
      ].join('\n'),
    );
    const data = compilerResult?.data as
      | {
          evidences: Array<{ category: string; file?: string }>;
        }
      | undefined;

    expect(runtimeResult?.matched).toBe(false);
    expect(compilerResult?.matched).toBe(true);
    expect(analysis.summary).toContain('Vue sfc compile');
    expect(analysis.relatedFiles).toContain(
      '/repo/app/src/components/UserCard.vue',
    );
    expect(data?.evidences[0]).toMatchObject({
      category: 'sfc_compile',
      file: '/repo/app/src/components/UserCard.vue',
    });
  });

  it('classifies Vue runtime warnings and keeps the component frame', async () => {
    const { analysis, runtimeResult } = await analyzeVue(
      [
        '[Vue warn]: Property "profileUrl" was accessed during render but is not defined on instance.',
        '  at <UserCard user=... >',
        '  at src/components/UserCard.vue:8:5',
      ].join('\n'),
    );
    const data = runtimeResult?.data as
      | {
          evidences: Array<{ category: string; file?: string }>;
        }
      | undefined;

    expect(runtimeResult?.matched).toBe(true);
    expect(analysis.summary).toContain('Vue component runtime');
    expect(analysis.relatedFiles).toContain('src/components/UserCard.vue');
    expect(data?.evidences[0]).toMatchObject({
      category: 'component_runtime',
      file: 'src/components/UserCard.vue',
    });
  });

  it('identifies Vue Router navigation failures', async () => {
    const { analysis, runtimeResult } = await analyzeVue(
      [
        '[Vue Router warn]: No match found for location with path "/admin/users"',
        '    at src/router/index.ts:34:12',
      ].join('\n'),
    );
    const data = runtimeResult?.data as
      | {
          evidences: Array<{ category: string; file?: string }>;
        }
      | undefined;

    expect(runtimeResult?.matched).toBe(true);
    expect(analysis.summary).toContain('Vue router');
    expect(analysis.relatedFiles).toContain('src/router/index.ts');
    expect(data?.evidences[0]).toMatchObject({
      category: 'router',
      file: 'src/router/index.ts',
    });
  });

  it('identifies Pinia installation/runtime ordering failures', async () => {
    const { analysis, runtimeResult } = await analyzeVue(
      [
        '[🍍]: "getActivePinia()" was called but there was no active Pinia.',
        '    at useUserStore (src/stores/user.ts:4:22)',
      ].join('\n'),
    );
    const data = runtimeResult?.data as
      | {
          evidences: Array<{ category: string; file?: string }>;
        }
      | undefined;

    expect(runtimeResult?.matched).toBe(true);
    expect(analysis.summary).toContain('Vue state manager');
    expect(analysis.relatedFiles).toContain('src/stores/user.ts');
    expect(data?.evidences[0]).toMatchObject({
      category: 'state_manager',
      file: 'src/stores/user.ts',
    });
  });

  it('detects Nuxt runtime context errors', async () => {
    const { analysis, runtimeResult } = await analyzeVue(
      [
        '[nuxt] A composable that requires access to the Nuxt instance was called outside of setup.',
        '    at useSession (app/composables/useSession.ts:6:10)',
      ].join('\n'),
    );
    const data = runtimeResult?.data as
      | {
          evidences: Array<{ category: string; file?: string }>;
        }
      | undefined;

    expect(runtimeResult?.matched).toBe(true);
    expect(analysis.summary).toContain('Nuxt runtime context');
    expect(analysis.relatedFiles).toContain('app/composables/useSession.ts');
    expect(data?.evidences[0]).toMatchObject({
      category: 'runtime_context',
      file: 'app/composables/useSession.ts',
    });
  });
});
