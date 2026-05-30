# error2fix

`error2fix` turns noisy terminal failures into compact, structured debugging context.

The project has two complementary entry points:

- A post-failure CLI that records failed shell commands and summarizes the latest failure for humans.
- An MCP server that lets coding agents request compressed failure context instead of reading full raw logs directly.

The core product goal is to reduce the amount of irrelevant log text that a developer or LLM has to inspect before reaching the useful failure signal.

## Why it exists

Terminal failures are usually noisy, repetitive, and hard to hand over to an AI assistant cleanly. Developers often have to copy a long log, explain what command ran, mention the working directory, and then ask the model to find the real signal.

`error2fix` keeps that workflow smaller:

1. The CLI captures normal command failures after they happen.
2. The diagnosis pipeline extracts the useful error signal from raw output.
3. The MCP server gives agents compact failure context before they ask for more evidence.

This is especially important for LLM workflows, where reading an entire raw log can waste tokens before the model reaches the actual error.

## CLI Installation

Install the CLI package:

```bash
npm install -g @error2fix/cli
```

Initialize shell integration once:

```bash
e2f init
```

After that, keep using your terminal normally. When a command fails, run:

```bash
e2f
```

The CLI stores local failure data under `~/.e2f`.

## MCP Installation

Install the MCP server package:

```bash
npm install -g @error2fix/mcp
```

The package exposes:

```bash
e2f-mcp
```

Configure your MCP client to start `e2f-mcp` as a stdio server.

VS Code style configuration:

```json
{
  "servers": {
    "error2fix": {
      "type": "stdio",
      "command": "e2f-mcp"
    }
  }
}
```

Cursor, Claude Desktop, Cline, and other `mcpServers`-style clients usually use:

```json
{
  "mcpServers": {
    "error2fix": {
      "command": "e2f-mcp"
    }
  }
}
```

## Product Direction

`error2fix` is built around a post-failure workflow. Users should not have to wrap every command with a special runner. A normal command fails, then `error2fix` helps inspect what happened.

For agent workflows, the goal is stricter: the model should not need to ingest an entire terminal log before it can reason about the failure. The MCP server is designed to expose a small loop:

1. Return the most valuable compressed failure brief.
2. Cache the failure as a session.
3. Let the agent query focused evidence only when the brief is not enough.
4. Return client-provided runtime context on demand.

This keeps raw logs outside the model context as much as the host client allows.

## MCP Workflow

The MCP server currently exposes:

- `e2f_get_latest_failure_brief`: accepts `stdout`, `stderr`, and optional command metadata, then returns the compact diagnosis, evidence IDs, token policy metadata, and a `sessionId`.
- `e2f_query_failure_evidence`: expands specific evidence from the cached session without returning the raw log.
- `e2f_get_runtime_context`: returns client-provided command, workspace, shell, OS, git, or safe environment context from the cached session.

The intended agent flow is:

```text
failed command output
  -> e2f_get_latest_failure_brief
  -> answer if sufficient
  -> e2f_query_failure_evidence only if more detail is needed
  -> e2f_get_runtime_context only if environment context matters
```

## Benchmark

The repository includes an early MCP benchmark dataset under `benchmarks/failures`.
Each case stores the original downloaded failure log as `raw.log`, so anyone can
rerun the same compression workflow locally.

Current frontend benchmark snapshot:

- Cases: 7
- Accuracy passing: 5/7
- Tool-call passing: 7/7
- Average reduction: 60.9%
- Average total MCP ratio: 39.1%
- Tool calls: 1 per case in the current run
- Report: `benchmarks/reports/report.md`

This dataset is intentionally small and currently includes several short logs.
Short-log cases expose response-shape overhead, so the MCP brief uses a smaller
compact output shape for small raw logs.

Run the benchmark with:

```bash
pnpm benchmark:mcp
```
