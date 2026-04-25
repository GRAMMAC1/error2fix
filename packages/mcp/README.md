# @error2fix/mcp

`@error2fix/mcp` is a standalone Model Context Protocol server for `error2fix`.

Install it globally:

```bash
npm install -g @error2fix/mcp
```

The package exposes a single executable:

```bash
e2f-mcp
```

Running `e2f-mcp` starts the MCP server over stdio.

## What it does

This server exposes diagnosis-oriented tools for AI clients. The second-phase
tool protocol is designed around compact briefs first, focused evidence queries
second, and runtime context only when it is useful.

Current tools:

- `e2f_get_latest_failure_brief`
- `e2f_query_failure_evidence`
- `e2f_get_runtime_context`

## Typical setup

1. Install and initialize the main CLI:

```bash
npm install -g error2fix
e2f init
```

2. Install this MCP server:

```bash
npm install -g @error2fix/mcp
```

3. Configure your MCP client to launch:

```bash
e2f-mcp
```

## Development

```bash
pnpm install
pnpm build
pnpm --filter @error2fix/mcp start
```
