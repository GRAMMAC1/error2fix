import os from 'node:os';
import path from 'node:path';
import type { SupportedShell } from '../types.js';

export interface ShellInstallTarget {
  shell: SupportedShell;
  rcFile: string | null;
  snippet: string;
}

export const beginMarker = '# >>> e2f init >>>';
export const endMarker = '# <<< e2f init <<<';

export function getShellRcPath(shell: SupportedShell): string | null {
  const home = os.homedir();
  switch (shell) {
    case 'zsh':
      return path.join(home, '.zshrc');
    case 'bash':
      return path.join(home, '.bashrc');
    case 'fish':
      return path.join(home, '.config', 'fish', 'config.fish');
    default:
      return null;
  }
}

export function getShellSnippet(shell: SupportedShell): string {
  if (shell === 'zsh') {
    return [
      beginMarker,
      'autoload -Uz add-zsh-hook',
      'typeset -g E2F_LAST_COMMAND=""',
      '__e2f_preexec() {',
      '  E2F_LAST_COMMAND="$1"',
      '}',
      '__e2f_precmd() {',
      '  local exit_code=$?',
      '  if [[ $exit_code -ne 0 && -n "$E2F_LAST_COMMAND" ]]; then',
      '    e2f __capture --shell zsh --command "$E2F_LAST_COMMAND" --exit-code "$exit_code" --cwd "$PWD" --timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >/dev/null 2>&1',
      '  fi',
      '}',
      'add-zsh-hook preexec __e2f_preexec',
      'add-zsh-hook precmd __e2f_precmd',
      endMarker,
    ].join('\n');
  }

  if (shell === 'bash') {
    return [
      beginMarker,
      '__E2F_LAST_COMMAND=""',
      '__e2f_preexec() {',
      '  case "$BASH_COMMAND" in',
      '    __e2f_precmd*|history* ) return ;;',
      '  esac',
      '  __E2F_LAST_COMMAND="$BASH_COMMAND"',
      '}',
      "trap '__e2f_preexec' DEBUG",
      '__e2f_precmd() {',
      '  local exit_code=$?',
      '  if [ "$exit_code" -ne 0 ] && [ -n "$__E2F_LAST_COMMAND" ]; then',
      '    e2f __capture --shell bash --command "$__E2F_LAST_COMMAND" --exit-code "$exit_code" --cwd "$PWD" --timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >/dev/null 2>&1',
      '  fi',
      '}',
      'PROMPT_COMMAND="__e2f_precmd${PROMPT_COMMAND:+;$PROMPT_COMMAND}"',
      endMarker,
    ].join('\n');
  }

  if (shell === 'fish') {
    return [
      beginMarker,
      'function __e2f_postexec --on-event fish_postexec',
      '  set -l exit_code $status',
      '  set -l command (history --max=1)',
      '  if test $exit_code -ne 0; and test -n "$command"',
      '    e2f __capture --shell fish --command "$command" --exit-code "$exit_code" --cwd "$PWD" --timestamp (date -u +"%Y-%m-%dT%H:%M:%SZ") >/dev/null 2>/dev/null',
      '  end',
      'end',
      endMarker,
    ].join('\n');
  }

  return '';
}

export function getShellInstallTarget(
  shell: SupportedShell,
): ShellInstallTarget {
  return {
    shell,
    rcFile: getShellRcPath(shell),
    snippet: getShellSnippet(shell),
  };
}

export function hasManagedSnippet(content: string): boolean {
  return content.includes(beginMarker) && content.includes(endMarker);
}

export function stripManagedSnippet(content: string): {
  content: string;
  removed: boolean;
} {
  const escapedBegin = beginMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = endMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `\\n?${escapedBegin}[\\s\\S]*?${escapedEnd}\\n?`,
    'g',
  );
  const next = content
    .replace(pattern, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
  return {
    content: next.length > 0 ? `${next}\n` : '',
    removed: next !== content.trimEnd(),
  };
}
