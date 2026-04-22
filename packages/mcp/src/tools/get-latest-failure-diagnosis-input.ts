import {
  buildDiagnosis,
  buildProjectContext,
  buildPrompt,
  buildPromptState,
  loadLatestSession,
  promptStateSchema,
} from '@error2fix/core';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const formatSchema = z.enum(['state', 'prompt', 'both']);

export const getLatestFailureDiagnosisInputInputSchema = {
  format: formatSchema
    .optional()
    .describe(
      'Controls whether the tool returns the structured diagnosis state, the generated prompt, or both.',
    ),
};

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
  data: z
    .object({
      sessionId: z.string(),
      timestamp: z.string(),
      format: formatSchema,
      state: promptStateSchema.optional(),
      prompt: z.string().optional(),
    })
    .optional(),
  error: toolErrorSchema.optional(),
};

export type GetLatestFailureDiagnosisInputArgs = {
  format?: 'state' | 'prompt' | 'both';
};

export const getLatestFailureDiagnosisInputResultSchema = z.object({
  ok: z.boolean(),
  data: z
    .object({
      sessionId: z.string(),
      timestamp: z.string(),
      format: formatSchema,
      state: promptStateSchema.optional(),
      prompt: z.string().optional(),
    })
    .optional(),
  error: toolErrorSchema.optional(),
});

export type GetLatestFailureDiagnosisInputResult = z.infer<
  typeof getLatestFailureDiagnosisInputResultSchema
>;

function makeTextContent(result: GetLatestFailureDiagnosisInputResult): string {
  if (!result.ok) {
    return result.error?.message ?? 'Unknown error';
  }

  const parts = [
    `sessionId: ${result.data?.sessionId ?? 'unknown'}`,
    `timestamp: ${result.data?.timestamp ?? 'unknown'}`,
    `format: ${result.data?.format ?? 'unknown'}`,
  ];

  if (result.data?.state) {
    parts.push('state available');
  }
  if (result.data?.prompt) {
    parts.push('prompt available');
  }

  return parts.join('\n');
}

export async function getLatestFailureDiagnosisInput(
  args: GetLatestFailureDiagnosisInputArgs = {},
): Promise<GetLatestFailureDiagnosisInputResult> {
  const format = args.format ?? 'both';

  // TODO use independent method to retrieve error stack traces.
  const session = await loadLatestSession();
  if (!session) {
    return {
      ok: false,
      error: {
        code: 'NO_FAILURE_SESSION',
        message: 'No failure session found',
      },
    };
  }

  try {
    const context = await buildProjectContext(session.cwd);
    const diagnosis = buildDiagnosis(
      session,
      context,
      undefined,
      undefined,
      session.stderrSnippet || session.stdoutSnippet || '',
    );
    const state = buildPromptState(session, context, {
      category: diagnosis.category,
      summary: diagnosis.summary,
      errorText:
        diagnosis.keyErrorSnippet ||
        session.stderrSnippet ||
        session.stdoutSnippet ||
        '',
    });
    const prompt = buildPrompt(state);

    return getLatestFailureDiagnosisInputResultSchema.parse({
      ok: true,
      data: {
        sessionId: session.id,
        timestamp: session.timestamp,
        format,
        state: format === 'prompt' ? undefined : state,
        prompt: format === 'state' ? undefined : prompt,
      },
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
        'Return the latest captured terminal failure as structured diagnosis input for downstream AI analysis.',
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
