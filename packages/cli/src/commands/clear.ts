import fs from 'node:fs/promises';
import { type E2FPaths, fileExists, getE2FPaths } from '@error2fix/core';
import {
  getShellRcPath,
  hasManagedSnippet,
  stripManagedSnippet,
} from '../shell/snippets.js';
import type { CliFlags, SupportedShell } from '../types.js';
import { formatClearResult, formatJsonPayload } from '../utils/format.js';

export interface ClearResult {
  removedHookFiles: string[];
  removedDataDir: boolean;
  activationCommand: string | null;
  activationHint: string;
}

export interface ClearTarget {
  shell: SupportedShell;
  rcFile: string | null;
}

function getAllShellRcFiles(): ClearTarget[] {
  return [
    { shell: 'zsh', rcFile: getShellRcPath('zsh') },
    { shell: 'bash', rcFile: getShellRcPath('bash') },
    { shell: 'fish', rcFile: getShellRcPath('fish') },
  ];
}

function getActivationCommand(
  shell: SupportedShell,
  rcFile: string | null,
): string | null {
  if (!rcFile) {
    return null;
  }
  return shell === 'unknown' ? null : `source ${rcFile}`;
}

export async function clearE2FHooks(options?: {
  shellTargets?: ClearTarget[];
  paths?: E2FPaths;
}): Promise<ClearResult> {
  const removedHookFiles: string[] = [];
  let activationCommand: string | null = null;
  const shellTargets = options?.shellTargets ?? getAllShellRcFiles();

  for (const target of shellTargets) {
    if (!target.rcFile || !(await fileExists(target.rcFile))) {
      continue;
    }

    const current = await fs.readFile(target.rcFile, 'utf8');
    if (!hasManagedSnippet(current)) {
      continue;
    }

    const stripped = stripManagedSnippet(current);
    if (stripped.removed) {
      await fs.writeFile(target.rcFile, stripped.content, 'utf8');
      removedHookFiles.push(target.rcFile);
      if (!activationCommand) {
        activationCommand = getActivationCommand(target.shell, target.rcFile);
      }
    }
  }

  const paths = options?.paths ?? getE2FPaths();
  const removedDataDir = await fileExists(paths.homeDir);
  if (removedDataDir) {
    await fs.rm(paths.homeDir, { recursive: true, force: true });
  }

  const activationHint = activationCommand
    ? `Run \`${activationCommand}\` in any current shell session that already loaded e2f hooks, or open a new terminal session, so the removed hook stops affecting the prompt.`
    : 'Open a new terminal session if your current shell had already loaded the e2f hook.';

  return {
    removedHookFiles,
    removedDataDir,
    activationCommand,
    activationHint,
  };
}

export async function runClearCommand(flags: CliFlags): Promise<string> {
  const result = await clearE2FHooks();
  return flags.json
    ? formatJsonPayload(result)
    : formatClearResult(result, flags.color ?? true);
}
