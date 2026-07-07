import { describe, expect, it } from 'vitest';
import {
  aggregateCoreAnalysis,
  buildCoreAnalysisInput,
  getDefaultPluginRegistry,
  runPlugins,
} from '../packages/core/src/index.js';
import type { LatestRawCapture } from '../packages/core/src/types/metadata.js';

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
    const input = await buildCoreAnalysisInput(capture);
    const pluginResults = await runPlugins(input, getDefaultPluginRegistry());
    const analysis = aggregateCoreAnalysis(input, pluginResults);

    expect(
      pluginResults.some(
        (result) => result.plugin === 'frontend-compiler' && result.matched,
      ),
    ).toBe(true);
    expect(analysis.host.shell).toBe('zsh');
    expect(analysis.host.os.platform.length).toBeGreaterThan(0);
    expect(analysis.summary).toContain('TypeScript');
    expect(analysis.relatedFiles).toContain('src/app.ts');
    expect(analysis.nextSteps.length).toBeGreaterThan(0);
  });

  it('keeps the lead diagnosis stable when plugin order changes', async () => {
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
        "src/components/UserCard.tsx:8:22 - error TS2307: Cannot find module '@app/widgets' or its corresponding type declarations.",
        'Error: Invalid hook call. Hooks can only be called inside of the body of a function component.',
        '    at useUser (src/components/UserCard.tsx:12:3)',
      ].join('\n'),
      stdoutLogFile: '/tmp/latest.stdout.log',
      stderrLogFile: '/tmp/latest.stderr.log',
    };
    const input = await buildCoreAnalysisInput(capture);
    const defaultRegistry = getDefaultPluginRegistry();
    const defaultResults = await runPlugins(input, defaultRegistry);
    const reversedResults = await runPlugins(
      input,
      [...defaultRegistry].reverse(),
    );

    expect(aggregateCoreAnalysis(input, reversedResults).summary).toBe(
      aggregateCoreAnalysis(input, defaultResults).summary,
    );
  });
});
