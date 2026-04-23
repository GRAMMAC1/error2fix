import { describe, expect, it } from 'vitest';
import {
  extractSignals,
  normalizeLogs,
  rankSignals,
  segmentLogs,
} from '../packages/core/src/parser/index.js';

describe('log pipeline', () => {
  it('normalizes noisy logs and extracts ranked signals from stderr-first failures', () => {
    const normalized = normalizeLogs({
      stdout:
        '\u001B[32mResolving packages...\u001B[0m\n100% |################|\n',
      stderr: [
        '\u001B[31mBuild failed\u001B[0m',
        '',
        'src/app.ts:14:7 - error TS2322: Type "string" is not assignable to type "number".',
        '    at compile (/workspace/src/app.ts:14:7)',
      ].join('\n'),
    });

    expect(normalized.stdout).toBe('');
    expect(normalized.stderr).toContain('Build failed');
    expect(normalized.stderr).not.toContain('\u001B');

    const segmented = segmentLogs(normalized);
    const signals = extractSignals(segmented);
    const ranked = rankSignals(signals);

    expect(ranked.snippet).toContain('TS2322');
    expect(ranked.stackLines[0]).toContain('compile');
    expect(ranked.relatedFiles).toContain('src/app.ts');
    expect(ranked.keywords).toContain('TS2322');
  });

  it('extracts useful keywords and files from mixed stdout and stderr logs', () => {
    const normalized = normalizeLogs({
      stdout: [
        'Running migration...',
        'see config in config/application.yml',
      ].join('\n'),
      stderr: [
        'Fatal error: DatabaseConnectionException',
        'permission denied while opening ./var/data.sqlite',
      ].join('\n'),
    });

    const ranked = rankSignals(extractSignals(segmentLogs(normalized)));

    expect(ranked.snippet).toContain('DatabaseConnectionException');
    expect(ranked.relatedFiles).toContain('./var/data.sqlite');
    expect(ranked.relatedFiles).toContain('config/application.yml');
    expect(ranked.keywords).toContain('DatabaseConnectionException');
    expect(ranked.keywords).toContain('permission denied');
  });
});
