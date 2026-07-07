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
  const vueResult = pluginResults.find(
    (result) => result.plugin === 'builtin-vue',
  );
  const typeScriptResult = pluginResults.find(
    (result) => result.plugin === 'builtin-typescript',
  );
  return {
    analysis: aggregateCoreAnalysis(input, pluginResults),
    typeScriptResult,
    vueResult,
  };
}

describe('Vue plugin', () => {
  it('detects Vue SFC compiler failures from Vite plugin output', async () => {
    const { analysis, typeScriptResult, vueResult } = await analyzeVue(
      [
        '[plugin:vite:vue] [@vue/compiler-sfc] <script setup> cannot contain ES module exports.',
        '/repo/app/src/components/UserCard.vue',
        '12 | export const title = "User"',
      ].join('\n'),
    );
    const data = vueResult?.data as
      | {
          diagnostics: Array<{ kind: string; file?: string }>;
          failureKinds: string[];
        }
      | undefined;

    expect(typeScriptResult?.matched).toBe(false);
    expect(vueResult?.matched).toBe(true);
    expect(analysis.summary).toContain('Vue sfc compile');
    expect(analysis.relatedFiles).toContain(
      '/repo/app/src/components/UserCard.vue',
    );
    expect(data?.diagnostics[0]).toMatchObject({
      kind: 'sfc_compile',
      file: '/repo/app/src/components/UserCard.vue',
    });
    expect(data?.failureKinds).toContain('sfc_compile');
  });

  it('classifies Vue runtime warnings and keeps the component frame', async () => {
    const { analysis, vueResult } = await analyzeVue(
      [
        '[Vue warn]: Property "profileUrl" was accessed during render but is not defined on instance.',
        '  at <UserCard user=... >',
        '  at src/components/UserCard.vue:8:5',
      ].join('\n'),
    );
    const data = vueResult?.data as
      | {
          diagnostics: Array<{ kind: string; file?: string }>;
        }
      | undefined;

    expect(vueResult?.matched).toBe(true);
    expect(analysis.summary).toContain('Vue vue runtime');
    expect(analysis.relatedFiles).toContain('src/components/UserCard.vue');
    expect(data?.diagnostics[0]).toMatchObject({
      kind: 'vue_runtime',
      file: 'src/components/UserCard.vue',
    });
  });

  it('identifies Vue Router navigation failures', async () => {
    const { analysis, vueResult } = await analyzeVue(
      [
        '[Vue Router warn]: No match found for location with path "/admin/users"',
        '    at src/router/index.ts:34:12',
      ].join('\n'),
    );
    const data = vueResult?.data as
      | {
          diagnostics: Array<{ kind: string; file?: string }>;
        }
      | undefined;

    expect(vueResult?.matched).toBe(true);
    expect(analysis.summary).toContain('Vue vue router');
    expect(analysis.relatedFiles).toContain('src/router/index.ts');
    expect(data?.diagnostics[0]).toMatchObject({
      kind: 'vue_router',
      file: 'src/router/index.ts',
    });
  });

  it('identifies Pinia installation/runtime ordering failures', async () => {
    const { analysis, vueResult } = await analyzeVue(
      [
        '[🍍]: "getActivePinia()" was called but there was no active Pinia.',
        '    at useUserStore (src/stores/user.ts:4:22)',
      ].join('\n'),
    );
    const data = vueResult?.data as
      | {
          diagnostics: Array<{ kind: string; file?: string }>;
        }
      | undefined;

    expect(vueResult?.matched).toBe(true);
    expect(analysis.summary).toContain('Vue pinia runtime');
    expect(analysis.relatedFiles).toContain('src/stores/user.ts');
    expect(data?.diagnostics[0]).toMatchObject({
      kind: 'pinia_runtime',
      file: 'src/stores/user.ts',
    });
    expect(vueResult?.suggestions?.join(' ')).toContain('Pinia is installed');
  });

  it('detects Nuxt runtime context errors', async () => {
    const { analysis, vueResult } = await analyzeVue(
      [
        '[nuxt] A composable that requires access to the Nuxt instance was called outside of setup.',
        '    at useSession (app/composables/useSession.ts:6:10)',
      ].join('\n'),
    );
    const data = vueResult?.data as
      | {
          diagnostics: Array<{ kind: string; file?: string }>;
        }
      | undefined;

    expect(vueResult?.matched).toBe(true);
    expect(analysis.summary).toContain('Vue nuxt runtime');
    expect(analysis.relatedFiles).toContain('app/composables/useSession.ts');
    expect(data?.diagnostics[0]).toMatchObject({
      kind: 'nuxt_runtime',
      file: 'app/composables/useSession.ts',
    });
  });
});
