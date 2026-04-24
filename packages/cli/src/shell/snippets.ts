import os from 'node:os';
import path from 'node:path';
import type { SupportedShell } from '@error2fix/core';

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
      'typeset -g E2F_CAPTURE_STDOUT=""',
      'typeset -g E2F_CAPTURE_STDERR=""',
      'typeset -g E2F_ORIGINAL_STDOUT=-1',
      'typeset -g E2F_ORIGINAL_STDERR=-1',
      '__e2f_preexec() {',
      '  E2F_LAST_COMMAND="$1"',
      '  command mkdir -p "$HOME/.e2f/logs"',
      '  local capture_base="$HOME/.e2f/logs/$(date -u +%Y%m%dT%H%M%SZ)-$$"',
      '  E2F_CAPTURE_STDOUT="${capture_base}.stdout.log"',
      '  E2F_CAPTURE_STDERR="${capture_base}.stderr.log"',
      '  : >| "$E2F_CAPTURE_STDOUT"',
      '  : >| "$E2F_CAPTURE_STDERR"',
      '  exec {E2F_ORIGINAL_STDOUT}>&1',
      '  exec {E2F_ORIGINAL_STDERR}>&2',
      '  exec > >(tee -a "$E2F_CAPTURE_STDOUT" >&$E2F_ORIGINAL_STDOUT)',
      '  exec 2> >(tee -a "$E2F_CAPTURE_STDERR" >&$E2F_ORIGINAL_STDERR)',
      '}',
      '__e2f_precmd() {',
      '  local exit_code=$?',
      '  if [[ $E2F_ORIGINAL_STDOUT -ne -1 ]]; then',
      '    exec 1>&$E2F_ORIGINAL_STDOUT',
      '    exec {E2F_ORIGINAL_STDOUT}>&-',
      '    E2F_ORIGINAL_STDOUT=-1',
      '  fi',
      '  if [[ $E2F_ORIGINAL_STDERR -ne -1 ]]; then',
      '    exec 2>&$E2F_ORIGINAL_STDERR',
      '    exec {E2F_ORIGINAL_STDERR}>&-',
      '    E2F_ORIGINAL_STDERR=-1',
      '  fi',
      '  if [[ $exit_code -ne 0 && -n "$E2F_LAST_COMMAND" ]]; then',
      '    e2f __capture --shell zsh --command "$E2F_LAST_COMMAND" --exit-code "$exit_code" --cwd "$PWD" --timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --stdout-log "$E2F_CAPTURE_STDOUT" --stderr-log "$E2F_CAPTURE_STDERR" >/dev/null 2>&1',
      '  else',
      '    command rm -f "$E2F_CAPTURE_STDOUT" "$E2F_CAPTURE_STDERR"',
      '  fi',
      '  E2F_CAPTURE_STDOUT=""',
      '  E2F_CAPTURE_STDERR=""',
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
      '__E2F_CAPTURE_ACTIVE=0',
      '__E2F_CAPTURE_STDOUT=""',
      '__E2F_CAPTURE_STDERR=""',
      '__E2F_ORIGINAL_STDOUT=-1',
      '__E2F_ORIGINAL_STDERR=-1',
      '__e2f_preexec() {',
      '  if [ "${__E2F_CAPTURE_ACTIVE:-0}" -eq 1 ]; then',
      '    return',
      '  fi',
      '  case "$BASH_COMMAND" in',
      '    __e2f_preexec*|__e2f_precmd*|history* ) return ;;',
      '  esac',
      '  __E2F_LAST_COMMAND="$BASH_COMMAND"',
      '  __E2F_CAPTURE_ACTIVE=1',
      '  command mkdir -p "$HOME/.e2f/logs"',
      '  local capture_base="$HOME/.e2f/logs/$(date -u +%Y%m%dT%H%M%SZ)-$$"',
      '  __E2F_CAPTURE_STDOUT="${capture_base}.stdout.log"',
      '  __E2F_CAPTURE_STDERR="${capture_base}.stderr.log"',
      '  : > "$__E2F_CAPTURE_STDOUT"',
      '  : > "$__E2F_CAPTURE_STDERR"',
      '  exec {__E2F_ORIGINAL_STDOUT}>&1',
      '  exec {__E2F_ORIGINAL_STDERR}>&2',
      '  exec > >(tee -a "$__E2F_CAPTURE_STDOUT" >&${__E2F_ORIGINAL_STDOUT})',
      '  exec 2> >(tee -a "$__E2F_CAPTURE_STDERR" >&${__E2F_ORIGINAL_STDERR})',
      '}',
      "trap '__e2f_preexec' DEBUG",
      '__e2f_precmd() {',
      '  local exit_code=$?',
      '  if [ "${__E2F_ORIGINAL_STDOUT:-1}" -ne -1 ]; then',
      '    exec 1>&${__E2F_ORIGINAL_STDOUT}',
      '    exec {__E2F_ORIGINAL_STDOUT}>&-',
      '    __E2F_ORIGINAL_STDOUT=-1',
      '  fi',
      '  if [ "${__E2F_ORIGINAL_STDERR:-1}" -ne -1 ]; then',
      '    exec 2>&${__E2F_ORIGINAL_STDERR}',
      '    exec {__E2F_ORIGINAL_STDERR}>&-',
      '    __E2F_ORIGINAL_STDERR=-1',
      '  fi',
      '  if [ "$exit_code" -ne 0 ] && [ -n "$__E2F_LAST_COMMAND" ]; then',
      '    e2f __capture --shell bash --command "$__E2F_LAST_COMMAND" --exit-code "$exit_code" --cwd "$PWD" --timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --stdout-log "$__E2F_CAPTURE_STDOUT" --stderr-log "$__E2F_CAPTURE_STDERR" >/dev/null 2>&1',
      '  else',
      '    command rm -f "$__E2F_CAPTURE_STDOUT" "$__E2F_CAPTURE_STDERR"',
      '  fi',
      '  __E2F_CAPTURE_STDOUT=""',
      '  __E2F_CAPTURE_STDERR=""',
      '  __E2F_CAPTURE_ACTIVE=0',
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

export function upsertManagedSnippet(
  content: string,
  snippet: string,
): {
  content: string;
  changed: boolean;
  inserted: boolean;
  replaced: boolean;
} {
  if (!hasManagedSnippet(content)) {
    const next = `${content.trimEnd()}\n\n${snippet}\n`;
    return {
      content: next,
      changed: true,
      inserted: true,
      replaced: false,
    };
  }

  if (content.includes(snippet)) {
    return {
      content,
      changed: false,
      inserted: false,
      replaced: false,
    };
  }

  const stripped = stripManagedSnippet(content);
  const next = `${stripped.content.trimEnd()}\n\n${snippet}\n`;
  return {
    content: next,
    changed: true,
    inserted: false,
    replaced: true,
  };
}
