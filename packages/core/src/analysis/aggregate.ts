import type { CoreAnalysis, CoreAnalysisInput } from '../types/core.js';
import type { PluginResult } from '../types/plugin.js';

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function firstNonEmptyLine(text: string | undefined): string | undefined {
  return text
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
}

function pickLeadResult(
  pluginResults: PluginResult<unknown, unknown>[],
): PluginResult<unknown, unknown> | undefined {
  return (
    pluginResults.find(
      (result) => result.matched && result.plugin !== 'builtin-generic',
    ) ?? pluginResults.find((result) => result.matched)
  );
}

function buildSummary(
  input: CoreAnalysisInput,
  leadResult: PluginResult<unknown, unknown> | undefined,
): string {
  return (
    leadResult?.summary ??
    firstNonEmptyLine(input.signals.snippet) ??
    firstNonEmptyLine(input.capture.stderr) ??
    firstNonEmptyLine(input.capture.stdout) ??
    `Command "${input.capture.metadata.command}" failed with exit code ${input.capture.metadata.exitCode}.`
  );
}

function buildLikelyCauses(
  input: CoreAnalysisInput,
  pluginResults: PluginResult<unknown, unknown>[],
): string[] {
  const causes = pluginResults
    .filter((result) => result.matched)
    .map((result) => result.summary ?? '')
    .filter(Boolean);

  if (input.signals.keywords.length > 0) {
    causes.push(
      `The log contains strong error markers such as ${input.signals.keywords.slice(0, 3).join(', ')}.`,
    );
  }

  if (input.signals.relatedFiles.length > 0) {
    causes.push(
      'The failure references concrete project files, which usually narrows the root cause quickly.',
    );
  }

  return unique(causes).slice(0, 5);
}

function buildNextSteps(
  input: CoreAnalysisInput,
  pluginResults: PluginResult<unknown, unknown>[],
): string[] {
  const pluginSuggestions = pluginResults.flatMap(
    (result) => result.suggestions ?? [],
  );

  const genericSteps = [
    input.signals.relatedFiles[0]
      ? `Inspect ${input.signals.relatedFiles[0]} first.`
      : 'Inspect the first high-signal error line in stderr.',
    input.signals.stackLines.length > 0
      ? 'Trace the top stack frame back to the application code path.'
      : 'Re-run the command with more verbose logging if the failure is still ambiguous.',
  ];

  return unique([...pluginSuggestions, ...genericSteps]).slice(0, 6);
}

export function aggregateCoreAnalysis(
  input: CoreAnalysisInput,
  pluginResults: PluginResult<unknown, unknown>[],
): CoreAnalysis {
  const leadResult = pickLeadResult(pluginResults);

  return {
    summary: buildSummary(input, leadResult),
    keySnippet: leadResult?.keySnippet ?? input.signals.snippet,
    likelyCauses: buildLikelyCauses(input, pluginResults),
    nextSteps: buildNextSteps(input, pluginResults),
    relatedFiles: unique([
      ...input.signals.relatedFiles,
      ...pluginResults.flatMap((result) => result.relatedFiles ?? []),
    ]).slice(0, 10),
    pluginResults,
  };
}
