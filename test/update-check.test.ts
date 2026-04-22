import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  shouldCheckForUpdates,
  startUpdateCheck,
} from '../packages/cli/src/update.js';
import { getE2FPaths } from '../packages/core/src/utils/paths.js';

describe('update checks', () => {
  const cleanup: string[] = [];
  const originalHome = process.env.HOME;

  afterEach(async () => {
    process.env.HOME = originalHome;
    await Promise.all(
      cleanup
        .splice(0)
        .map((entry) => fs.rm(entry, { recursive: true, force: true })),
    );
  });

  it('skips checks for internal commands and json mode', () => {
    expect(
      shouldCheckForUpdates('__capture', {
        json: false,
        color: true,
        debug: false,
      }),
    ).toBe(false);
    expect(
      shouldCheckForUpdates('fix', {
        json: true,
        color: true,
        debug: false,
      }),
    ).toBe(false);
  });

  it('uses a fresh cached version result when available', async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), 'e2f-update-'));
    cleanup.push(home);
    process.env.HOME = home;

    const paths = getE2FPaths(path.join(home, '.e2f'));
    await fs.mkdir(paths.cacheDir, { recursive: true });
    await fs.writeFile(
      path.join(paths.cacheDir, 'update-check.json'),
      JSON.stringify({
        checkedAt: new Date().toISOString(),
        latestVersion: '9.9.9',
      }),
      'utf8',
    );

    const result = await startUpdateCheck();
    expect(result.updateAvailable).toBe(true);
    expect(result.latestVersion).toBe('9.9.9');
  });
});
