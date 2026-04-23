import { z } from 'zod';
import type { CoreAnalysis, CoreAnalysisInput } from '../types/core.js';
import type { PluginContextEntry } from '../types/plugin.js';

const pluginContextEntrySchema = z.object({
  plugin: z.string(),
  kind: z.string(),
  data: z.unknown(),
});

export const promptStateSchema = z.object({
  command: z.object({
    raw: z.string(),
    cwd: z.string(),
    shell: z.string().optional(),
    timestamp: z.string(),
    exitCode: z.number().int(),
  }),
  host: z.object({
    os: z.object({
      platform: z.string(),
      release: z.string().optional(),
      arch: z.string().optional(),
    }),
    shell: z.string().optional(),
    env: z.record(z.string(), z.string()).optional(),
  }),
  workspace: z.object({
    cwd: z.string(),
    root: z.string().optional(),
    files: z.array(z.string()),
    git: z
      .object({
        branch: z.string().nullable().optional(),
      })
      .optional(),
  }),
  error: z.object({
    snippet: z.string().optional(),
    stackLines: z.array(z.string()),
    relatedFiles: z.array(z.string()),
    keywords: z.array(z.string()),
  }),
  pluginContext: z.array(pluginContextEntrySchema),
  goal: z.object({
    ask: z.array(
      z.enum(['root_cause', 'explanation', 'fix_steps', 'files_to_inspect']),
    ),
  }),
});

export type PromptState = z.infer<typeof promptStateSchema>;

function buildPluginContext(
  analysis: CoreAnalysis,
): PluginContextEntry<unknown>[] {
  return analysis.pluginResults
    .filter((result) => result.matched)
    .map((result) => ({
      plugin: result.plugin,
      kind: 'analysis',
      data: {
        summary: result.summary,
        relatedFiles: result.relatedFiles ?? [],
        suggestions: result.suggestions ?? [],
        context: result.context,
        data: result.data,
      },
    }));
}

export function buildPromptState(
  input: CoreAnalysisInput,
  analysis: CoreAnalysis,
): PromptState {
  return promptStateSchema.parse({
    command: {
      raw: input.capture.metadata.command,
      cwd: input.capture.metadata.cwd,
      shell: input.capture.metadata.shell,
      timestamp: input.capture.metadata.timestamp,
      exitCode: input.capture.metadata.exitCode,
    },
    host: input.capture.host,
    workspace: input.workspace,
    error: {
      snippet: analysis.keySnippet ?? input.signals.snippet,
      stackLines: input.signals.stackLines,
      relatedFiles: analysis.relatedFiles,
      keywords: input.signals.keywords,
    },
    pluginContext: buildPluginContext(analysis),
    goal: {
      ask: ['root_cause', 'explanation', 'fix_steps', 'files_to_inspect'],
    },
  });
}
