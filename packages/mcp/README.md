# @error2fix/mcp

MCP server for agent-facing frontend `error2fix` diagnosis workflows.

This package exposes compact frontend failure-analysis tools for IDEs and coding agents. It is currently focused on JavaScript/TypeScript frontend workflows such as package scripts, bundlers, framework compile errors, and dependency resolution. The client provides the raw failed command output, and the server returns small, structured responses that are safer for an LLM token budget than full log replay.

## Tools

- `e2f_get_latest_failure_brief`: compresses client-provided `stdout` and `stderr` into a diagnosis brief and creates a session.
- `e2f_query_failure_evidence`: returns focused evidence windows from a cached session.
- `e2f_get_runtime_context`: returns client-provided command and environment context from a cached session.
