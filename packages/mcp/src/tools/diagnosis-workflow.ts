import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WORKFLOW_DESCRIPTION } from '../constants/index.js';
import { getLatestFailureBrief } from './get-latest-failure-brief.js';
import { getRuntimeContext } from './get-runtime-context.js';
import { queryFailureEvidence } from './query-failure-evidence.js';
import {
  getLatestFailureBriefInputSchema,
  getLatestFailureBriefResultSchema,
  getRuntimeContextInputSchema,
  getRuntimeContextResultSchema,
  queryFailureEvidenceInputSchema,
  queryFailureEvidenceResultSchema,
} from './tool-protocol.js';
import type {
  GetLatestFailureBriefArgs,
  GetRuntimeContextArgs,
  QueryFailureEvidenceArgs,
} from './tool-protocol.js';
import { makeToolText } from './tool-utils.js';

export function registerDiagnosisWorkflowTools(server: McpServer): void {
  server.registerTool(
    'e2f_get_latest_failure_brief',
    {
      title: 'Get Latest Failure Brief',
      description: [
        'Analyze raw terminal failure logs provided by the LLM client and return a compact, high-signal diagnosis. Always pass both logs.stdout and logs.stderr, using an empty string for streams with no output.',
        'Use this tool first before sending raw logs into model context.',
        'It returns a compact diagnosis, focused evidence excerpts, likely root-cause hints, and guidance on whether enough information is available to answer directly.',
        'This tool is optimized to reduce token usage by accepting raw stdout/stderr as tool input and returning only compact structured evidence.',
        WORKFLOW_DESCRIPTION,
      ].join(' '),
      inputSchema: getLatestFailureBriefInputSchema,
      outputSchema: getLatestFailureBriefResultSchema.shape,
    },
    async (args: GetLatestFailureBriefArgs) => {
      const result = await getLatestFailureBrief(args);
      return {
        content: [
          {
            type: 'text',
            text: makeToolText(result),
          },
        ],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'e2f_query_failure_evidence',
    {
      title: 'Query Failure Evidence',
      description: [
        'Query focused evidence from the latest captured failure log.',
        'Use this only when e2f_get_latest_failure_brief is insufficient.',
        'Prefer querying by evidence IDs returned by the diagnosis.',
        'This tool returns a few focused evidence sections instead of full raw logs.',
        WORKFLOW_DESCRIPTION,
      ].join(' '),
      inputSchema: queryFailureEvidenceInputSchema,
      outputSchema: queryFailureEvidenceResultSchema.shape,
    },
    async (args: QueryFailureEvidenceArgs) => {
      const result = await queryFailureEvidence(args);
      return {
        content: [
          {
            type: 'text',
            text: makeToolText(result),
          },
        ],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'e2f_get_runtime_context',
    {
      title: 'Get Runtime Context',
      description: [
        'Return safe runtime and workspace context for the latest captured failure.',
        'Use this when diagnosis depends on command facts, OS, shell, package manager, runtime versions, workspace files, git state, or allowlisted environment variables.',
        'Sensitive environment variables are never returned.',
        WORKFLOW_DESCRIPTION,
      ].join(' '),
      inputSchema: getRuntimeContextInputSchema,
      outputSchema: getRuntimeContextResultSchema.shape,
    },
    async (args: GetRuntimeContextArgs) => {
      const result = await getRuntimeContext(args);
      return {
        content: [
          {
            type: 'text',
            text: makeToolText(result),
          },
        ],
        structuredContent: result,
      };
    },
  );
}
