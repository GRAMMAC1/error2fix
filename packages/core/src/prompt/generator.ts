import type { PromptState } from './state.js';

function formatGoal(
  goal: PromptState['goal']['ask'][number],
  index: number,
): string {
  const labels: Record<PromptState['goal']['ask'][number], string> = {
    root_cause: 'Root cause',
    explanation: 'Explanation',
    fix_steps: 'Concrete fix steps',
    files_to_inspect: 'Files to inspect',
  };
  return `${index + 1}. ${labels[goal]}`;
}

function formatOs(state: PromptState): string {
  const { platform, release, arch } = state.host.os;
  return [platform, release, arch].filter(Boolean).join(' ') || 'unknown';
}

function formatBlock(title: string, values: string[]): string[] {
  return values.length > 0 ? [title, ...values] : [title, '  None'];
}

export function buildPrompt(state: PromptState): string {
  const stackLines = state.error.stackLines.map((line) => `  ${line}`);
  const relatedFiles = state.error.relatedFiles.map((file) => `  ${file}`);
  const pluginContext = state.pluginContext.map((entry) => {
    const data =
      typeof entry.data === 'object' && entry.data !== null
        ? JSON.stringify(entry.data)
        : String(entry.data);
    return `  ${entry.plugin} (${entry.kind}): ${data}`;
  });

  return [
    'You are diagnosing a failed developer terminal command.',
    '',
    'Command:',
    `- Raw command: ${state.command.raw}`,
    `- Working directory: ${state.command.cwd}`,
    `- Shell: ${state.command.shell ?? 'unknown'}`,
    `- Timestamp: ${state.command.timestamp}`,
    `- Exit code: ${state.command.exitCode}`,
    '',
    'Host:',
    `- OS: ${formatOs(state)}`,
    '',
    'Workspace:',
    `- Root: ${state.workspace.root ?? state.workspace.cwd}`,
    `- Git branch: ${state.workspace.git?.branch ?? 'unknown'}`,
    `- Known files: ${state.workspace.files.join(', ') || 'none'}`,
    '',
    'Error details:',
    `- Key snippet: ${state.error.snippet ?? 'No high-signal snippet extracted.'}`,
    ...formatBlock('- Stack lines:', stackLines),
    ...formatBlock('- Related files:', relatedFiles),
    `- Keywords: ${state.error.keywords.join(', ') || 'none'}`,
    '',
    ...formatBlock('Plugin context:', pluginContext),
    '',
    'Please provide:',
    ...state.goal.ask.map((goal, index) => formatGoal(goal, index)),
  ].join('\n');
}
