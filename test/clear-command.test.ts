import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { clearE2FHooks } from '../packages/cli/src/commands/clear.js';
import { getE2FPaths } from '../packages/core/src/utils/paths.js';
import { ensureE2FDirs } from '../packages/core/src/utils/store.js';

describe('clearE2FHooks', () => {
  const cleanup: string[] = [];

  afterEach(async () => {
    await Promise.all(
      cleanup
        .splice(0)
        .map((entry) => fs.rm(entry, { recursive: true, force: true })),
    );
  });

  it('removes managed shell hooks and deletes the local e2f data directory', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'e2f-clear-'));
    cleanup.push(tempDir);

    const rcFile = path.join(tempDir, '.zshrc');
    await fs.writeFile(
      rcFile,
      [
        'export PATH=$PATH:$HOME/bin',
        '',
        '# >>> e2f init >>>',
        'autoload -Uz add-zsh-hook',
        'typeset -g E2F_LAST_COMMAND=""',
        '# <<< e2f init <<<',
        '',
        "alias ll='ls -la'",
        '',
      ].join('\n'),
      'utf8',
    );

    const paths = getE2FPaths(path.join(tempDir, '.e2f'));
    await ensureE2FDirs(paths);
    await fs.writeFile(paths.latestStderrLogFile, 'stderr\n', 'utf8');

    const result = await clearE2FHooks({
      shellTargets: [{ shell: 'zsh', rcFile }],
      paths,
    });

    const rcContents = await fs.readFile(rcFile, 'utf8');
    expect(result.removedHookFiles).toEqual([rcFile]);
    expect(result.removedDataDir).toBe(true);
    expect(result.activationCommand).toBe(`source ${rcFile}`);
    expect(rcContents).toContain('export PATH=$PATH:$HOME/bin');
    expect(rcContents).toContain("alias ll='ls -la'");
    expect(rcContents).not.toContain('# >>> e2f init >>>');
    await expect(fs.access(paths.homeDir)).rejects.toThrow();
  });

  it('reports no-op cleanup when no hook or local data exists', async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'e2f-clear-empty-'),
    );
    cleanup.push(tempDir);

    const rcFile = path.join(tempDir, '.bashrc');
    await fs.writeFile(rcFile, 'export PATH=$PATH:$HOME/bin\n', 'utf8');
    const paths = getE2FPaths(path.join(tempDir, '.e2f'));

    const result = await clearE2FHooks({
      shellTargets: [{ shell: 'bash', rcFile }],
      paths,
    });

    expect(result.removedHookFiles).toEqual([]);
    expect(result.removedDataDir).toBe(false);
    expect(result.activationCommand).toBeNull();
  });
});
