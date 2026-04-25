import { z } from 'zod';

export const mcpToolErrorSchema = z.object({
  code: z.enum([
    'NO_FAILURE_SESSION',
    'INVALID_SESSION',
    'CONTEXT_BUILD_FAILED',
    'PROMPT_BUILD_FAILED',
    'NOT_IMPLEMENTED',
    'UNKNOWN_ERROR',
  ]),
  message: z.string(),
});

export type McpToolError = z.infer<typeof mcpToolErrorSchema>;

export const failureSourceSchema = z.enum(['stderr', 'stdout', 'combined']);

export const failureSignalKindSchema = z.enum([
  'compiler_error',
  'test_failure',
  'runtime_exception',
  'missing_dependency',
  'permission',
  'network',
  'syntax',
  'unknown',
]);

export const lineRangeSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});

export const commandContextSchema = z.object({
  raw: z.string(),
  cwd: z.string(),
  shell: z.string(),
  exitCode: z.number().int(),
});

export const osContextSchema = z.object({
  platform: z.string(),
  release: z.string().optional(),
  arch: z.string().optional(),
});

export const runtimeContextEntrySchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  detectedFrom: z
    .enum(['path', 'package_json', 'lockfile', 'config', 'unknown'])
    .optional(),
});

export const failureSignalSchema = z.object({
  id: z.string(),
  kind: failureSignalKindSchema,
  source: failureSourceSchema,
  confidence: z.number().min(0).max(1),
  message: z.string(),
  excerpt: z.string(),
  relatedFiles: z.array(z.string()),
  keywords: z.array(z.string()),
  lineRange: lineRangeSchema.optional(),
});

export type FailureSource = z.infer<typeof failureSourceSchema>;
export type FailureSignalKind = z.infer<typeof failureSignalKindSchema>;
export type FailureSignal = z.infer<typeof failureSignalSchema>;

export const getLatestFailureBriefInputSchema = {
  maxSignals: z.number().int().min(1).max(10).optional(),
  maxSnippetChars: z.number().int().min(1).max(4000).optional(),
  includeEnv: z.enum(['summary', 'safe', 'none']).optional(),
};

export const getLatestFailureBriefResultSchema = z.object({
  ok: z.boolean(),
  sessionId: z.string().optional(),
  capturedAt: z.string().optional(),
  command: commandContextSchema.optional(),
  environment: z
    .object({
      os: osContextSchema,
      packageManager: z.string().optional(),
      runtimes: z.array(runtimeContextEntrySchema).optional(),
      safeEnv: z.record(z.string()).optional(),
      envAvailableViaTool: z.boolean(),
    })
    .optional(),
  brief: z
    .object({
      summary: z.string(),
      failureKind: failureSignalKindSchema.optional(),
      confidence: z.number().min(0).max(1),
      keySnippet: z.string().optional(),
      likelyCauses: z.array(z.string()),
      suggestedFixes: z.array(z.string()),
      filesToInspect: z.array(z.string()),
    })
    .optional(),
  signals: z.array(failureSignalSchema).optional(),
  next: z
    .object({
      canAnswerFromBrief: z.boolean(),
      recommendedTool: z
        .enum(['e2f_query_failure_evidence', 'e2f_get_runtime_context'])
        .optional(),
      reason: z.string().optional(),
      suggestedQueries: z.array(z.string()).optional(),
    })
    .optional(),
  tokenPolicy: z
    .object({
      rawLogsOmitted: z.boolean(),
      estimatedRawLogChars: z.number().int().nonnegative(),
      returnedChars: z.number().int().nonnegative(),
    })
    .optional(),
  error: mcpToolErrorSchema.optional(),
});

export type GetLatestFailureBriefArgs = z.infer<
  z.ZodObject<typeof getLatestFailureBriefInputSchema>
>;
export type GetLatestFailureBriefResult = z.infer<
  typeof getLatestFailureBriefResultSchema
>;

export const queryFailureEvidenceInputSchema = {
  sessionId: z.string().optional(),
  signalIds: z.array(z.string()).optional(),
  query: z
    .object({
      text: z.string().optional(),
      regex: z.string().optional(),
      relatedFile: z.string().optional(),
      keyword: z.string().optional(),
      source: failureSourceSchema.optional(),
    })
    .optional(),
  contextLines: z.number().int().min(0).max(30).optional(),
  maxSpans: z.number().int().min(1).max(10).optional(),
  maxCharsPerSpan: z.number().int().min(1).max(8000).optional(),
};

export const queryFailureEvidenceResultSchema = z.object({
  ok: z.boolean(),
  sessionId: z.string().optional(),
  spans: z
    .array(
      z.object({
        id: z.string(),
        source: failureSourceSchema,
        reason: z.string(),
        confidence: z.number().min(0).max(1),
        lineRange: lineRangeSchema,
        excerpt: z.string(),
        relatedSignalIds: z.array(z.string()),
        relatedFiles: z.array(z.string()),
        keywords: z.array(z.string()),
      }),
    )
    .optional(),
  exhausted: z.boolean().optional(),
  nextSuggestedQueries: z.array(z.string()).optional(),
  error: mcpToolErrorSchema.optional(),
});

export type QueryFailureEvidenceArgs = z.infer<
  z.ZodObject<typeof queryFailureEvidenceInputSchema>
>;
export type QueryFailureEvidenceResult = z.infer<
  typeof queryFailureEvidenceResultSchema
>;

export const runtimeContextSectionSchema = z.enum([
  'os',
  'shell',
  'package_manager',
  'runtime_versions',
  'workspace',
  'git',
  'safe_env',
]);

export const getRuntimeContextInputSchema = {
  sessionId: z.string().optional(),
  include: z.array(runtimeContextSectionSchema).optional(),
  envKeys: z.array(z.string()).optional(),
};

export const getRuntimeContextResultSchema = z.object({
  ok: z.boolean(),
  sessionId: z.string().optional(),
  os: osContextSchema.optional(),
  shell: z.string().optional(),
  packageManager: z
    .object({
      name: z.enum(['pnpm', 'npm', 'yarn', 'bun', 'unknown']),
      version: z.string().optional(),
      lockfile: z.string().optional(),
    })
    .optional(),
  runtimes: z.array(runtimeContextEntrySchema).optional(),
  workspace: z
    .object({
      cwd: z.string(),
      root: z.string().optional(),
      detectedFiles: z.array(z.string()),
    })
    .optional(),
  git: z
    .object({
      branch: z.string().nullable().optional(),
    })
    .optional(),
  safeEnv: z.record(z.string()).optional(),
  redactions: z
    .array(
      z.object({
        key: z.string(),
        reason: z.enum(['secret_like', 'not_allowlisted', 'too_large']),
      }),
    )
    .optional(),
  error: mcpToolErrorSchema.optional(),
});

export type RuntimeContextSection = z.infer<typeof runtimeContextSectionSchema>;
export type GetRuntimeContextArgs = z.infer<
  z.ZodObject<typeof getRuntimeContextInputSchema>
>;
export type GetRuntimeContextResult = z.infer<
  typeof getRuntimeContextResultSchema
>;
