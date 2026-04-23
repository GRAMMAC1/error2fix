import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execa } from 'execa';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const distCli = path.join(repoRoot, 'packages', 'cli', 'dist', 'cli.js');

async function runCli(tempHome: string, args: string[]) {
  return execa(process.execPath, [distCli, ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      HOME: tempHome,
      SHELL: '/bin/zsh',
      NO_COLOR: '1',
    },
  });
}

describe('CLI e2e', () => {
  const cleanup: string[] = [];

  beforeAll(async () => {
    await execa('pnpm', ['build'], {
      cwd: repoRoot,
      env: {
        ...process.env,
        NO_COLOR: '1',
      },
    });
  });

  afterEach(async () => {
    await Promise.all(
      cleanup
        .splice(0)
        .map((entry) => fs.rm(entry, { recursive: true, force: true })),
    );
  });

  it('initializes shell integration and clears it end to end', async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'e2f-e2e-'));
    cleanup.push(tempHome);

    const initResult = await runCli(tempHome, ['init', '--no-color']);
    const rcFile = path.join(tempHome, '.zshrc');
    const e2fHome = path.join(tempHome, '.e2f');
    const latestStderrLogFile = path.join(e2fHome, 'logs', 'latest.stderr.log');

    expect(initResult.stdout).toContain('Initialization Complete');
    expect(initResult.stdout).toContain(`Activate now: source ${rcFile}`);

    const rcAfterInit = await fs.readFile(rcFile, 'utf8');
    expect(rcAfterInit).toContain('# >>> e2f init >>>');
    await expect(fs.access(e2fHome)).resolves.toBeUndefined();

    await fs.mkdir(path.dirname(latestStderrLogFile), { recursive: true });
    await fs.writeFile(latestStderrLogFile, 'simulated stderr\n', 'utf8');

    const clearResult = await runCli(tempHome, ['clear', '--no-color']);
    expect(clearResult.stdout).toContain('Clear Complete');
    expect(clearResult.stdout).toContain(`Apply removal now: source ${rcFile}`);
    expect(clearResult.stdout).toContain(
      'Local data directory: removed (~/.e2f)',
    );

    const rcAfterClear = await fs.readFile(rcFile, 'utf8');
    expect(rcAfterClear).not.toContain('# >>> e2f init >>>');
    await expect(fs.access(e2fHome)).rejects.toThrow();
  });

  it('does not duplicate the managed shell snippet when init is run twice', async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'e2f-e2e-init-'));
    cleanup.push(tempHome);

    await runCli(tempHome, ['init', '--no-color']);
    const secondInit = await runCli(tempHome, ['init', '--no-color']);
    const rcFile = path.join(tempHome, '.zshrc');
    const rcContents = await fs.readFile(rcFile, 'utf8');
    const snippetCount = rcContents.match(/# >>> e2f init >>>/g)?.length ?? 0;

    expect(secondInit.stdout).toContain('already contained e2f snippet');
    expect(snippetCount).toBe(1);
  });
});
