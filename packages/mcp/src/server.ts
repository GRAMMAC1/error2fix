import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './create-server.js';
import { MCP_SERVER_DESCRIPTION, MCP_SERVER_INFO } from './metadata.js';

async function main(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Keep a minimal startup log on stderr so stdio JSON-RPC stays clean.
  console.error(
    `[${MCP_SERVER_INFO.name}] ${MCP_SERVER_DESCRIPTION} (v${MCP_SERVER_INFO.version})`,
  );
}

await main();
