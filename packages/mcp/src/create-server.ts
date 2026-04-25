import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MCP_SERVER_INFO } from './metadata.js';
import { registerDiagnosisWorkflowTools } from './tools/diagnosis-workflow.js';
import { registerGetLatestFailureDiagnosisInputTool } from './tools/get-latest-failure-diagnosis-input.js';

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: MCP_SERVER_INFO.name,
    version: MCP_SERVER_INFO.version,
  });
  registerDiagnosisWorkflowTools(server);
  registerGetLatestFailureDiagnosisInputTool(server);
  return server;
}
