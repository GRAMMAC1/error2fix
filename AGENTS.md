# AGENTS

## Project Overview

- Project name: `error2fix`
- Runtime: Node.js
- Language: TypeScript
- Package manager: `pnpm`
- CLI entrypoint: `e2f`
- Workspace packages:
  - `packages/core`
  - `packages/cli`
  - `packages/mcp`

`error2fix` is a post-failure terminal diagnosis CLI. Users do not wrap commands with `e2f`. They run `e2f init` once, let normal shell commands fail, and then run `e2f` to inspect the latest captured failure context.

## Key Commands

- Install dependencies: `pnpm install`
- Build: `pnpm build`
- Run tests: `pnpm test`
- Typecheck: `pnpm typecheck`
- Format: `pnpm format`
- Biome check: `pnpm check`
- Biome lint: `pnpm lint`

## Repository Structure

- `packages/core/src/`: shared diagnosis logic, parsing, storage, prompt state, and eval logic
- `packages/cli/src/`: CLI commands, shell integration, and terminal formatting
- `packages/mcp/src/`: MCP server scaffold and future MCP integrations
- `test/`: unit and white-box integration tests
- `e2e/`: black-box CLI tests

## Development Notes

- Prefer `pnpm` for all package management and script execution.
- Keep all `dist/` directories treated as generated output. Do not hand-edit generated files.
- This project uses:
  - Biome for formatting and linting
  - Vitest for unit and e2e tests
  - `simple-git-hooks` + `lint-staged` for pre-commit checks on staged files

## Testing Expectations

Before finishing non-trivial changes, run the relevant checks:

- `pnpm check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

For CLI behavior changes, prefer adding or updating tests in `e2e/` when the behavior is user-visible.

## Product Constraints

- Default UX must remain post-failure diagnosis.
- Do not introduce a required `e2f run -- <command>` wrapper flow.
- `e2f init` installs shell integration.
- `e2f clear` removes shell hooks and clears local `~/.e2f` data.
- Local storage lives under `~/.e2f/`.
- MVP should not require any cloud dependency or API key.
- The publishable npm package is `packages/cli`.

## Implementation Preferences

- Preserve the existing CLI shape and command names unless there is an explicit request to change them.
- Keep `core` independent from CLI and MCP protocol concerns.
- Prefer small, testable modules over large command files.
- When updating shell integration, keep behavior aligned across `zsh`, `bash`, and `fish`.
- When adding checks or tooling, keep them lightweight and compatible with local development.
