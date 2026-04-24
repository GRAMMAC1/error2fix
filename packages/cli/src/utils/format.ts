import type { CoreAnalysis } from '@error2fix/core';
import { getColors, printKeyValue } from './terminal.js';

export function formatDiagnosis(result: CoreAnalysis, color = true): string {
  const c = getColors(color);
  const os = [
    result.host.os.platform,
    result.host.os.release,
    result.host.os.arch,
  ]
    .filter(Boolean)
    .join(' ');
  return [
    c.bold(c.green('Diagnosis')),
    printKeyValue('Host', os || 'unknown'),
    printKeyValue('Shell', result.host.shell ?? 'unknown'),
    printKeyValue('Structured summary', result.summary),
    printKeyValue(
      'Key error snippet',
      result.keySnippet || 'No error snippet captured',
    ),
    printKeyValue('Related files', result.relatedFiles.join(', ') || 'none'),
    '',
    c.bold(c.yellow('Likely Causes')),
    ...result.likelyCauses.map(
      (cause: string, index: number) => `${index + 1}. ${cause}`,
    ),
    '',
    c.bold(c.yellow('Suggested Next Steps')),
    ...result.nextSteps.map(
      (step: string, index: number) => `${index + 1}. ${step}`,
    ),
  ].join('\n');
}

export function formatChangedFiles(
  result: {
    createdDirectories: string[];
    rcFile: string | null;
    shellConfigUpdated: boolean;
    configFileCreated: boolean;
    activationCommand?: string | null;
    activationHint?: string;
  },
  color = true,
): string {
  const c = getColors(color);
  const lines = [
    c.bold(c.green('Initialization Complete')),
    `Directories ensured: ${result.createdDirectories.join(', ')}`,
    `Config file: ${result.configFileCreated ? 'created' : 'already present'}`,
    `Shell config: ${result.shellConfigUpdated ? `updated (${result.rcFile})` : 'already contained e2f snippet'}`,
  ];
  if (result.activationCommand) {
    lines.push(`Activate now: ${result.activationCommand}`);
  }
  if (result.activationHint) {
    lines.push(result.activationHint);
  }
  return lines.join('\n');
}

export function formatJsonPayload(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}

export function formatClearResult(
  result: {
    removedHookFiles: string[];
    removedDataDir: boolean;
    activationCommand: string | null;
    activationHint: string;
  },
  color = true,
): string {
  const c = getColors(color);
  const lines = [
    c.bold(c.green('Clear Complete')),
    `Shell hooks removed: ${result.removedHookFiles.length > 0 ? result.removedHookFiles.join(', ') : 'none found'}`,
    `Local data directory: ${result.removedDataDir ? 'removed (~/.e2f)' : 'not present'}`,
  ];
  if (result.activationCommand) {
    lines.push(`Apply removal now: ${result.activationCommand}`);
  }
  lines.push(result.activationHint);
  return lines.join('\n');
}
