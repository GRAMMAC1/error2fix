import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import readline from 'node:readline';
import { promisify } from 'node:util';
import { getE2FPaths, readJsonFile } from '@error2fix/core';
import type { CliFlags } from '@error2fix/core';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as {
  name: string;
  version: string;
};
const execFileAsync = promisify(execFile);
const UPDATE_CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const CHECK_TIMEOUT_MS = 800;

interface UpdateCache {
  checkedAt: string;
  latestVersion: string;
}

interface UpdateCheckResult {
  updateAvailable: boolean;
  latestVersion: string | null;
}

function getUpdateCacheFile(): string {
  return `${getE2FPaths().cacheDir}/update-check.json`;
}

function isInteractive(flags: CliFlags): boolean {
  return (
    process.stdin.isTTY === true &&
    process.stdout.isTTY === true &&
    !flags.json &&
    process.env.CI !== 'true'
  );
}

function parseVersion(version: string): number[] {
  return version
    .replace(/^v/, '')
    .split('.')
    .map((segment) => Number.parseInt(segment, 10) || 0);
}

function isNewerVersion(
  currentVersion: string,
  latestVersion: string,
): boolean {
  const current = parseVersion(currentVersion);
  const latest = parseVersion(latestVersion);
  const length = Math.max(current.length, latest.length);

  for (let index = 0; index < length; index += 1) {
    const currentPart = current[index] ?? 0;
    const latestPart = latest[index] ?? 0;
    if (latestPart > currentPart) {
      return true;
    }
    if (latestPart < currentPart) {
      return false;
    }
  }

  return false;
}

async function writeUpdateCache(latestVersion: string): Promise<void> {
  const paths = getE2FPaths();
  await fs.mkdir(paths.cacheDir, { recursive: true });
  await fs.writeFile(
    getUpdateCacheFile(),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        latestVersion,
      } satisfies UpdateCache,
      null,
      2,
    ),
    'utf8',
  );
}

async function readFreshCache(): Promise<UpdateCache | null> {
  const cache = await readJsonFile<UpdateCache>(getUpdateCacheFile());
  if (!cache?.checkedAt || !cache.latestVersion) {
    return null;
  }

  const checkedAt = new Date(cache.checkedAt).getTime();
  if (Number.isNaN(checkedAt)) {
    return null;
  }

  if (Date.now() - checkedAt > UPDATE_CACHE_TTL_MS) {
    return null;
  }

  return cache;
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      'npm',
      ['view', packageJson.name, 'version', '--json'],
      {
        timeout: CHECK_TIMEOUT_MS,
        windowsHide: true,
      },
    );
    const version = stdout.trim().replace(/^"|"$/g, '');
    if (!version) {
      return null;
    }
    await writeUpdateCache(version);
    return version;
  } catch {
    return null;
  }
}

export function shouldCheckForUpdates(
  commandName: string | null,
  flags: CliFlags,
): boolean {
  return (
    isInteractive(flags) && commandName !== '__capture' && commandName !== null
  );
}

export async function startUpdateCheck(): Promise<UpdateCheckResult> {
  const cached = await readFreshCache();
  if (cached) {
    return {
      updateAvailable: isNewerVersion(
        packageJson.version,
        cached.latestVersion,
      ),
      latestVersion: cached.latestVersion,
    };
  }

  const latestVersion = await fetchLatestVersion();
  return {
    updateAvailable:
      latestVersion !== null &&
      isNewerVersion(packageJson.version, latestVersion),
    latestVersion,
  };
}

export async function maybePromptForUpgrade(
  updatePromise: Promise<UpdateCheckResult> | null,
): Promise<void> {
  if (!updatePromise) {
    return;
  }

  let result: UpdateCheckResult;
  try {
    result = await Promise.race([
      updatePromise,
      new Promise<UpdateCheckResult>((resolve) => {
        setTimeout(
          () => resolve({ updateAvailable: false, latestVersion: null }),
          CHECK_TIMEOUT_MS,
        );
      }),
    ]);
  } catch {
    return;
  }

  if (!result.updateAvailable || !result.latestVersion) {
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await new Promise<string>((resolve) => {
      rl.question(
        `A newer version of ${packageJson.name} is available (${packageJson.version} -> ${result.latestVersion}). Upgrade now with npm? [y/N] `,
        resolve,
      );
    });

    if (!/^y(es)?$/i.test(answer.trim())) {
      return;
    }

    console.log(`Upgrading ${packageJson.name} to ${result.latestVersion}...`);
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        'npm',
        ['install', '-g', `${packageJson.name}@latest`],
        {
          stdio: 'inherit',
          windowsHide: true,
        },
      );

      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`npm exited with code ${code ?? 'unknown'}`));
      });
    });
    console.log(
      `Upgrade complete. Relaunch ${packageJson.name} to use the latest version.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to upgrade ${packageJson.name}: ${message}`);
  } finally {
    rl.close();
  }
}
