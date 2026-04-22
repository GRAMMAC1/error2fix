# error2fix

`error2fix` helps you troubleshoot failed terminal commands without changing how you work.

You run your commands as usual. If something fails, just run `e2f` and get a clean diagnosis with the command, exit code, working directory, project context, and suggested next steps.

It also comes with a separate MCP server package, so AI tools can read the latest captured failure and help you debug it with the right context.

## Why it exists

Most error helpers ask you to rerun your command through a wrapper.

`error2fix` takes the opposite approach:

1. Install it once
2. Run `e2f init` once
3. Keep using your normal shell
4. When a command fails, run `e2f`

That means less copy-pasting, less “here’s what I ran” back-and-forth, and a much faster path from failure to fix.

## Install the CLI

```bash
npm install -g error2fix
```

Then initialize shell integration:

```bash
e2f init
```

To enable it right away in your current shell:

```bash
source ~/.zshrc
```

If you use another shell, source the matching config file or just open a new terminal window.

## Basic usage

Run something that fails:

```bash
pnpm build
```

Then ask `error2fix` for the latest failure:

```bash
e2f
```

You can also call the command explicitly:

```bash
e2f fix
```

## Commands

### `e2f`

Alias for `e2f fix`.

### `e2f fix`

Show a diagnosis for the latest captured failure.

### `e2f init`

Install shell hooks so failed commands are recorded automatically.

### `e2f clear`

Remove the shell hooks and clear local `~/.e2f` data.

## CLI options

```bash
e2f --json
e2f --no-color
e2f --debug
```

## Install the MCP server

The MCP server is published as a separate package:

```bash
npm install -g @error2fix/mcp
```

This gives you a standalone executable:

```bash
e2f-mcp
```

Running `e2f-mcp` starts the MCP server over stdio.

## How the MCP server fits in

The CLI captures failures locally under `~/.e2f`.

The MCP server lets AI tools read that latest failure and use it as structured debugging context.

So the flow looks like this:

1. You install `error2fix`
2. You run `e2f init`
3. A terminal command fails
4. Your AI tool calls the `error2fix` MCP server
5. The model gets the latest failure context and helps you debug it

## Register the MCP server in VS Code

VS Code supports local stdio MCP servers through `mcp.json`. See the official docs here:

- [Use MCP servers in VS Code](https://code.visualstudio.com/docs/copilot/chat/mcp-servers)

Create `.vscode/mcp.json` in your workspace:

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

Once that’s in place, your AI features in VS Code can discover and call the `error2fix` MCP tools.

## Register the MCP server in Codex

Codex can register local stdio MCP servers directly from the command line.

Add the server:

```bash
codex mcp add error2fix -- e2f-mcp
```

Check that it’s registered:

```bash
codex mcp list
```

After that, Codex can call the `error2fix` MCP tools when you ask it to inspect the latest terminal failure.

## A typical MCP workflow

Install both packages:

```bash
npm install -g error2fix @error2fix/mcp
e2f init
```

Run a command that fails:

```bash
pnpm build
```

Then, inside your AI tool, ask something like:

```text
Help me diagnose the latest failed terminal command.
```

The model can use the MCP server to retrieve the latest failure context instead of making you paste everything by hand.

## Local data

`error2fix` stores local data under:

```text
~/.e2f/
```

This includes captured failure sessions and lightweight cache files used by the CLI.
