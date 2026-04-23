import { diagnoseCapture, loadLatestRawCapture } from '@error2fix/core';
import type { CoreAnalysis } from '@error2fix/core';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export const getLatestFailureDiagnosisInputInputSchema = {};

export const toolErrorSchema = z.object({
  code: z.enum([
    'NO_FAILURE_SESSION',
    'INVALID_SESSION',
    'CONTEXT_BUILD_FAILED',
    'PROMPT_BUILD_FAILED',
    'UNKNOWN_ERROR',
  ]),
  message: z.string(),
});

export const getLatestFailureDiagnosisInputOutputSchema = {
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: toolErrorSchema.optional(),
};

export type GetLatestFailureDiagnosisInputArgs = Record<string, never>;

export const getLatestFailureDiagnosisInputResultSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: toolErrorSchema.optional(),
});

export type GetLatestFailureDiagnosisInputResult = z.infer<
  typeof getLatestFailureDiagnosisInputResultSchema
>;

function makeTextContent(result: GetLatestFailureDiagnosisInputResult): string {
  if (!result.ok) {
    return result.error?.message ?? 'Unknown error';
  }

  const analysis = result.data as CoreAnalysis | undefined;
  if (!analysis) {
    return 'analysis available';
  }
  return [
    `summary: ${analysis.summary}`,
    `keySnippet: ${analysis.keySnippet ?? 'none'}`,
    `relatedFiles: ${analysis.relatedFiles.join(', ') || 'none'}`,
  ].join('\n');
}

export async function getLatestFailureDiagnosisInput(
  _args: GetLatestFailureDiagnosisInputArgs = {},
): Promise<GetLatestFailureDiagnosisInputResult> {
  const capture = await loadLatestRawCapture();
  if (!capture) {
    return {
      ok: false,
      error: {
        code: 'NO_FAILURE_SESSION',
        message: 'No failure session found',
      },
    };
  }

  try {
    const analysis = await diagnoseCapture(capture);

    return getLatestFailureDiagnosisInputResultSchema.parse({
      ok: true,
      data: analysis,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message,
      },
    };
  }
}

export function registerGetLatestFailureDiagnosisInputTool(
  server: McpServer,
): void {
  server.registerTool(
    'get_latest_failure_diagnosis_input',
    {
      title: 'Get Latest Failure Diagnosis Input',
      description:
        'Return the latest captured terminal failure as aggregated CoreAnalysis output.',
      inputSchema: getLatestFailureDiagnosisInputInputSchema,
      outputSchema: getLatestFailureDiagnosisInputOutputSchema,
    },
    async (args: GetLatestFailureDiagnosisInputArgs) => {
      const result = await getLatestFailureDiagnosisInput(args);
      return {
        content: [
          {
            type: 'text',
            text: makeTextContent(result),
          },
        ],
        structuredContent: result,
      };
    },
  );
}
