import type {
  ExplainResult,
  FailureSession,
  ProjectContext,
} from '../types.js';
import { getColors, printKeyValue } from './terminal.js';

export function formatContext(
  session: FailureSession,
  context: ProjectContext,
  color = true,
): string {
  const c = getColors(color);
  const lines = [
    c.bold(c.cyan('Latest Failure Context')),
    printKeyValue('Command', session.command),
    printKeyValue('Exit code', String(session.exitCode)),
    printKeyValue('CWD', session.cwd),
    printKeyValue('Shell', session.shell),
    printKeyValue('Timestamp', session.timestamp),
    printKeyValue('Project type', context.projectType),
    printKeyValue('Framework', context.framework),
    printKeyValue('Git branch', context.gitBranch ?? 'unknown'),
    printKeyValue('Lockfiles', context.lockfiles.join(', ') || 'none'),
    printKeyValue('Config files', context.configFiles.join(', ') || 'none'),
  ];
  return lines.join('\n');
}

export function formatDiagnosis(result: ExplainResult, color = true): string {
  const c = getColors(color);
  const { session, context, diagnosis } = result;
  return [
    formatContext(session, context, color),
    '',
    c.bold(c.green('Diagnosis')),
    printKeyValue('Structured summary', diagnosis.summary),
    printKeyValue('Likely category', diagnosis.category),
    printKeyValue(
      'Key error snippet',
      diagnosis.keyErrorSnippet || 'No error snippet captured',
    ),
    '',
    c.bold(c.yellow('Suggested Next Steps')),
    ...diagnosis.suggestedNextSteps.map(
      (step: string, index: number) => `${index + 1}. ${step}`,
    ),
    '',
    c.bold(c.magenta('Generated Prompt')),
    diagnosis.prompt,
  ].join('\n');
}

export function formatHistory(
  sessions: FailureSession[],
  color = true,
): string {
  const c = getColors(color);
  const lines = [c.bold(c.cyan('Recent Failure Sessions'))];
  if (sessions.length === 0) {
    lines.push('No captured sessions found.');
    return lines.join('\n');
  }
  for (const session of sessions) {
    lines.push(
      `${session.timestamp}  [${session.shell}]  exit=${session.exitCode}  ${session.command}`,
    );
  }
  return lines.join('\n');
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
