# error2fix

`error2fix` is a TypeScript CLI for post-failure terminal diagnosis. After a command fails in your shell, you run `e2f` and get a structured summary, project context, likely failure category, next steps, and an AI-ready prompt.

## Why this exists

Most terminal helpers require you to rerun the failing command through a wrapper. `error2fix` is designed around the opposite UX:

1. Install once.
2. Run `e2f init` once.
3. Let your normal shell commands fail naturally.
4. Run `e2f` to inspect the latest failure context.

## Install

```bash
npm install -g error2fix
e2f init
```

Activate the hook in the current shell right away:

```bash
source ~/.zshrc
```

If you use another shell, source its config file instead, or just open a new terminal session.

## Commands

### `e2f`

Alias of `e2f fix`. Loads the latest captured failure session, enriches it with project context, and prints:

- failed command
- exit code
- cwd
- shell type
- timestamp
- project type detection
- relevant environment info
- structured error summary
- generated diagnosis prompt

### `e2f fix`

Prints the full diagnosis view for the latest captured failure session.

### `e2f prompt`

Prints only the generated AI-ready diagnosis prompt.

### `e2f context`

Prints the raw captured session plus enriched project context for the latest failure.

### `e2f explain <logfile>`

Parses an existing log file and produces the same structured diagnosis output.

### `e2f history`

Lists recent captured failure sessions from local storage.

### `e2f init`

Detects the current shell, ensures local storage exists under `~/.e2f`, and appends a managed hook snippet to the appropriate shell config:

- `~/.zshrc`
- `~/.bashrc`
- `~/.config/fish/config.fish`

### `e2f clear`

Removes the managed shell hook from supported shell config files and deletes local data under `~/.e2f`.

Use it when you want to stop automatic failure capture and reset local e2f state:

```bash
e2f clear
```

## Global options

- `--json` for machine-readable output
- `--no-color` to disable ANSI colors
- `--debug` to enable debug-oriented output paths later

## Local storage

`error2fix` stores data locally under:

```text
~/.e2f/
  config.json
  sessions/
    latest.json
    <timestamp>-<hash>.json
  logs/
  cache/
```

Failure sessions follow this schema:

```json
{
  "id": "string",
  "command": "npm run build",
  "exitCode": 1,
  "cwd": "/Users/foo/project",
  "shell": "zsh",
  "timestamp": "2026-04-21T12:00:00.000Z",
  "stdoutSnippet": "",
  "stderrSnippet": "",
  "projectType": "nextjs",
  "env": {
    "os": "",
    "nodeVersion": "",
    "packageManager": ""
  }
}
```

## Shell hook snippets

The CLI installs these automatically with `e2f init`, but they are included here for reference.

### zsh

```zsh
autoload -Uz add-zsh-hook
typeset -g E2F_LAST_COMMAND=""
__e2f_preexec() {
  E2F_LAST_COMMAND="$1"
}
__e2f_precmd() {
  local exit_code=$?
  if [[ $exit_code -ne 0 && -n "$E2F_LAST_COMMAND" ]]; then
    e2f __capture --shell zsh --command "$E2F_LAST_COMMAND" --exit-code "$exit_code" --cwd "$PWD" --timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >/dev/null 2>&1
  fi
}
add-zsh-hook preexec __e2f_preexec
add-zsh-hook precmd __e2f_precmd
```

### bash

```bash
__E2F_LAST_COMMAND=""
__e2f_preexec() {
  case "$BASH_COMMAND" in
    __e2f_precmd*|history* ) return ;;
  esac
  __E2F_LAST_COMMAND="$BASH_COMMAND"
}
trap '__e2f_preexec' DEBUG
__e2f_precmd() {
  local exit_code=$?
  if [ "$exit_code" -ne 0 ] && [ -n "$__E2F_LAST_COMMAND" ]; then
    e2f __capture --shell bash --command "$__E2F_LAST_COMMAND" --exit-code "$exit_code" --cwd "$PWD" --timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >/dev/null 2>&1
  fi
}
PROMPT_COMMAND="__e2f_precmd${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
```

### fish

```fish
function __e2f_postexec --on-event fish_postexec
  set -l exit_code $status
  set -l command (history --max=1)
  if test $exit_code -ne 0; and test -n "$command"
    e2f __capture --shell fish --command "$command" --exit-code "$exit_code" --cwd "$PWD" --timestamp (date -u +"%Y-%m-%dT%H:%M:%SZ") >/dev/null 2>/dev/null
  end
end
```

## Project context enrichment

When `e2f` or `e2f fix` runs, it inspects the recorded `cwd` and collects:

- `package.json` summary
- package scripts
- lockfile presence
- `tsconfig.json` compiler option summary
- `vite.config`, `next.config`, and `turbo.json` presence
- framework detection: `nextjs`, `vite`, `react`, `node`, `monorepo`
- current git branch when available

## Error categories

- `dependency_install`
- `build_failure`
- `typescript_error`
- `test_failure`
- `runtime_error`
- `unknown`

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## Publishing the CLI

The publishable npm package lives in [packages/cli](/Users/grammac/github/error2fix/packages/cli).

To verify the package contents before publishing:

```bash
pnpm pack:cli
```

To publish the public npm package:

```bash
pnpm publish:cli
```

The publish flow uses a repo-local npm cache under `.npm-cache/`, so it does not depend on the health or permissions of `~/.npm`.

## Notes for the MVP

- Shell integration captures command metadata reliably first.
- Full stdout/stderr capture is intentionally conservative in the MVP.
- `e2f explain <logfile>` is the stronger path when users have full logs.
- AI provider integration is intentionally abstractable later; the MVP defaults to prompt generation only.
