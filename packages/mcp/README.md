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

This server reads the latest captured `error2fix` raw logs from `~/.e2f/logs/` and exposes diagnosis-oriented tools for AI clients.

Current tool:

- `get_latest_failure_diagnosis_input`

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
