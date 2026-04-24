import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ensureE2FDirs,
  fileExists,
  getE2FPaths,
  readJsonFile,
} from '@error2fix/core';
import type { SupportedShell } from '@error2fix/core';
import { detectShell } from './detect.js';
import { getShellInstallTarget, upsertManagedSnippet } from './snippets.js';

export interface InitResult {
  shell: SupportedShell;
  rcFile: string | null;
  createdDirectories: string[];
  shellConfigUpdated: boolean;
  configFileCreated: boolean;
  snippet: string;
  activationCommand: string | null;
  activationHint: string;
}

function getActivationCommand(
  shell: SupportedShell,
  rcFile: string | null,
): string | null {
  if (!rcFile) {
    return null;
  }

  switch (shell) {
    case 'zsh':
    case 'bash':
      return `source ${rcFile}`;
    case 'fish':
      return `source ${rcFile}`;
    default:
      return null;
  }
}

export async function initializeShellIntegration(
  explicitShell?: string,
): Promise<InitResult> {
  const shell = detectShell(explicitShell);
  const paths = getE2FPaths();
  await ensureE2FDirs(paths);

  const createdDirectories = [paths.homeDir, paths.logsDir, paths.cacheDir];
  const configExists = await fileExists(paths.configFile);
  if (!configExists) {
    await fs.writeFile(
      paths.configFile,
      JSON.stringify({ initializedAt: Date.now() }, null, 2),
    );
  } else {
    await readJsonFile(paths.configFile);
  }

  const target = getShellInstallTarget(shell);
  let shellConfigUpdated = false;
  if (target.rcFile && target.snippet) {
    await fs.mkdir(path.dirname(target.rcFile), { recursive: true });
    const current = (await fileExists(target.rcFile))
      ? await fs.readFile(target.rcFile, 'utf8')
      : '';
    const next = upsertManagedSnippet(current, target.snippet);
    if (next.changed) {
      await fs.writeFile(target.rcFile, next.content, 'utf8');
      shellConfigUpdated = true;
    }
  }

  const activationCommand = getActivationCommand(shell, target.rcFile);
  const activationHint = activationCommand
    ? `Run \`${activationCommand}\` in your current shell, or open a new terminal session, to activate the hook immediately.`
    : 'Open a new terminal session after initialization to ensure the shell hook is loaded.';

  return {
    shell,
    rcFile: target.rcFile,
    createdDirectories,
    shellConfigUpdated,
    configFileCreated: !configExists,
    snippet: target.snippet,
    activationCommand,
    activationHint,
  };
}
