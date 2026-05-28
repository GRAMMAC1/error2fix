import { describe, expect, it } from 'vitest';
import { getLatestFailureBrief } from '../packages/mcp/src/tools/get-latest-failure-brief.js';
import { getRuntimeContext } from '../packages/mcp/src/tools/get-runtime-context.js';
import { queryFailureEvidence } from '../packages/mcp/src/tools/query-failure-evidence.js';

const NOISE_MARKER = 'MCP_TOKEN_BLOAT_REGRESSION_MARKER';

function makeLargeFailureInput() {
  const stdout = Array.from(
    { length: 160 },
    (_, index) =>
      `[build:${index}] emitted chunk-${index}.js with cache metadata ${NOISE_MARKER}`,
  ).join('\n');
  const noisyStderrPrefix = Array.from(
    { length: 180 },
    (_, index) =>
      `[debug:${index}] resolver trace ${NOISE_MARKER} package lookup took ${
        index + 1
      }ms`,
  ).join('\n');
  const noisyStderrSuffix = Array.from(
    { length: 180 },
    (_, index) =>
      `[watch:${index}] rebuild trace ${NOISE_MARKER} no actionable failure here`,
  ).join('\n');
  const stderr = [
    noisyStderrPrefix,
    '--- focused compiler failure follows ---',
    'diagnostic buffer line 1',
    'diagnostic buffer line 2',
    'diagnostic buffer line 3',
    'diagnostic buffer line 4',
    'compiler emitted one actionable diagnostic',
    'src/app.ts:14:7 - error TS2322: Type string is not assignable to type number.',
    '  const count: number = name;',
    '        ~~~~~',
    '--- focused compiler failure ends ---',
    noisyStderrSuffix,
  ].join('\n');

  return {
    command: {
      raw: 'pnpm build',
      cwd: process.cwd(),
      shell: 'zsh' as const,
      exitCode: 2,
      timestamp: '2026-04-26T08:00:00.000Z',
    },
    logs: {
      stdout,
      stderr,
    },
    rawChars: stdout.length + stderr.length,
  };
}

function requireSessionId(sessionId: string | undefined): string {
  expect(sessionId).toBeTypeOf('string');
  expect(sessionId?.length).toBeGreaterThan(0);
  return sessionId as string;
}

describe('MCP token-budget workflow', () => {
  it('uses a smaller compact brief for short failure logs', async () => {
    const shortNoise = Array.from(
      { length: 24 },
      (_, index) => `[vite:${index}] transform cache entry skipped`,
    ).join('\n');
    const stderr = [
      shortNoise,
      'src/App.svelte:12:5 bindable_invalid_location',
      '`$bindable()` can only be used inside a `$props()` declaration',
    ].join('\n');

    const brief = await getLatestFailureBrief({
      command: {
        raw: 'pnpm build',
        cwd: process.cwd(),
        shell: 'zsh',
        exitCode: 1,
      },
      logs: {
        stdout: '',
        stderr,
      },
    });

    expect(brief.ok).toBe(true);
    const serializedBrief = JSON.stringify(brief);
    expect(serializedBrief).toContain('bindable_invalid_location');
    expect(brief.confidence).toBeGreaterThan(0);
    expect(brief.evidence?.length).toBeGreaterThan(0);
    expect(brief.diagnosis).toBeUndefined();
    expect(brief.next).toBeUndefined();
    expect(brief.tokenPolicy).toBeUndefined();
    expect(serializedBrief.length).toBeLessThan(stderr.length * 1.2);
  });

  it('returns a compact latest failure brief without raw log noise', async () => {
    const input = makeLargeFailureInput();

    const brief = await getLatestFailureBrief({
      command: input.command,
      logs: input.logs,
      maxEvidence: 2,
      maxSnippetChars: 600,
    });

    expect(brief.ok).toBe(true);
    expect(brief.tokenPolicy?.rawLogsOmitted).toBe(true);
    expect(brief.tokenPolicy?.estimatedRawLogChars).toBe(input.rawChars);
    expect(brief.diagnosis?.summary).toContain('TS2322');
    expect(brief.diagnosis?.evidence.length).toBeLessThanOrEqual(2);

    const serializedBrief = JSON.stringify(brief);
    expect(serializedBrief).not.toContain(NOISE_MARKER);
    expect(serializedBrief.length).toBeLessThan(input.rawChars * 0.25);
    expect(brief.tokenPolicy?.returnedChars).toBeLessThan(
      input.rawChars * 0.25,
    );
  });

  it('returns focused evidence from a cached session without expanding the full log', async () => {
    const input = makeLargeFailureInput();
    const brief = await getLatestFailureBrief({
      command: input.command,
      logs: input.logs,
      maxEvidence: 2,
      maxSnippetChars: 600,
    });
    const sessionId = requireSessionId(brief.sessionId);

    const evidence = await queryFailureEvidence({
      sessionId,
      focus: {
        evidenceIds: ['evidence-1'],
        files: ['src/app.ts'],
        keywords: ['TS2322'],
      },
      maxSections: 2,
      maxCharsPerSection: 700,
    });

    expect(evidence.ok).toBe(true);
    expect(evidence.sessionId).toBe(sessionId);
    expect(evidence.evidence?.sections.length).toBeGreaterThan(0);
    expect(evidence.evidence?.sections.length).toBeLessThanOrEqual(2);

    const serializedEvidence = JSON.stringify(evidence);
    expect(serializedEvidence).toContain('TS2322');
    expect(serializedEvidence).toContain('src/app.ts');
    expect(serializedEvidence).not.toContain(NOISE_MARKER);
    expect(serializedEvidence.length).toBeLessThan(input.rawChars * 0.2);
  });

  it('reuses client-provided runtime context by session id or latest session', async () => {
    const input = makeLargeFailureInput();
    const brief = await getLatestFailureBrief({
      command: input.command,
      logs: input.logs,
    });
    const sessionId = requireSessionId(brief.sessionId);

    const contextBySession = await getRuntimeContext({
      sessionId,
      include: ['command', 'workspace'],
    });
    expect(contextBySession.ok).toBe(true);
    expect(contextBySession.contextSource).toBe('client_provided');
    expect(contextBySession.command).toEqual({
      raw: 'pnpm build',
      cwd: process.cwd(),
      shell: 'zsh',
      exitCode: 2,
      source: 'client_provided',
    });
    expect(contextBySession.workspace?.cwd).toBe(process.cwd());
    expect(contextBySession.safeEnv).toBeUndefined();

    const latestContext = await getRuntimeContext({
      include: ['command'],
    });
    expect(latestContext.ok).toBe(true);
    expect(latestContext.sessionId).toBe(sessionId);
    expect(latestContext.command?.raw).toBe('pnpm build');
    expect(latestContext.contextSource).toBe('client_provided');
  });
});
