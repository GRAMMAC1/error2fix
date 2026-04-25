import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { z } from 'zod';
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
  GetLatestFailureBriefResult,
  GetRuntimeContextArgs,
  GetRuntimeContextResult,
  QueryFailureEvidenceArgs,
  QueryFailureEvidenceResult,
} from './tool-protocol.js';

const WORKFLOW_DESCRIPTION = [
  'Recommended workflow: call e2f_get_latest_failure_brief first.',
  'If next.canAnswerFromBrief is true, answer without requesting raw logs.',
  'If more evidence is needed, call e2f_query_failure_evidence with signal IDs or suggested queries from the brief.',
  'Call e2f_get_runtime_context only when OS, shell, package manager, runtime versions, workspace, git, or safe environment details affect the fix.',
].join(' ');

function notImplementedResult<T extends z.ZodTypeAny>(
  schema: T,
  message: string,
): z.infer<T> {
  return schema.parse({
    ok: false,
    error: {
      code: 'NOT_IMPLEMENTED',
      message,
    },
  });
}

function makeToolText(result: {
  ok: boolean;
  error?: { message: string };
}): string {
  if (result.ok) {
    return 'Structured diagnosis data is available.';
  }
  return result.error?.message ?? 'Unknown error';
}

export async function getLatestFailureBrief(
  _args: GetLatestFailureBriefArgs = {},
): Promise<GetLatestFailureBriefResult> {
  return notImplementedResult(
    getLatestFailureBriefResultSchema,
    'e2f_get_latest_failure_brief is defined but not implemented yet.',
  );
}

export async function queryFailureEvidence(
  _args: QueryFailureEvidenceArgs = {},
): Promise<QueryFailureEvidenceResult> {
  return notImplementedResult(
    queryFailureEvidenceResultSchema,
    'e2f_query_failure_evidence is defined but not implemented yet.',
  );
}

export async function getRuntimeContext(
  _args: GetRuntimeContextArgs = {},
): Promise<GetRuntimeContextResult> {
  return notImplementedResult(
    getRuntimeContextResultSchema,
    'e2f_get_runtime_context is defined but not implemented yet.',
  );
}

export function registerDiagnosisWorkflowTools(server: McpServer): void {
  server.registerTool(
    'e2f_get_latest_failure_brief',
    {
      title: 'Get Latest Failure Brief',
      description: [
        'Get the latest captured terminal failure as a compact, high-signal diagnosis brief.',
        'Use this tool first before reading raw logs.',
        'It returns command facts, a safe environment summary, ranked error signals, likely root-cause hints, and guidance on whether enough information is available to answer directly.',
        'This tool is optimized to reduce token usage by omitting full stdout and stderr unless a follow-up evidence query is needed.',
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
        'Prefer querying by signalIds returned by the brief.',
        'This tool returns small log spans around relevant matches instead of full raw logs.',
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
        'Use this when diagnosis depends on OS, shell, package manager, runtime versions, workspace files, git state, or allowlisted environment variables.',
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
