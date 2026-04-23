import type { CoreAnalysisInput } from '../types/core.js';
import type { Error2FixPlugin } from '../types/plugin.js';

function firstNonEmptyLine(text: string | undefined): string | undefined {
  return text
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
}

export const genericPlugin: Error2FixPlugin<
  {
    keywordCount: number;
    relatedFileCount: number;
  },
  {
    evidence: string[];
  }
> = {
  meta: {
    name: 'builtin-generic',
    displayName: 'Generic Failure Analysis',
  },
  detect() {
    return true;
  },
  collectContext(input: CoreAnalysisInput) {
    return {
      keywordCount: input.signals.keywords.length,
      relatedFileCount: input.signals.relatedFiles.length,
    };
  },
  analyze(input, context) {
    const leadLine =
      firstNonEmptyLine(input.signals.snippet) ??
      firstNonEmptyLine(input.capture.stderr) ??
      firstNonEmptyLine(input.capture.stdout) ??
      `Command "${input.capture.metadata.command}" failed with exit code ${input.capture.metadata.exitCode}.`;

    const suggestions = [
      input.signals.relatedFiles.length > 0
        ? `Open the first referenced file: ${input.signals.relatedFiles[0]}.`
        : 'Review the first non-empty error line in stderr.',
      input.signals.stackLines.length > 0
        ? 'Follow the top stack frame to locate the failing code path.'
        : 'Re-run the command with verbose logging if the failure remains unclear.',
    ];

    return {
      plugin: 'builtin-generic',
      matched: true,
      summary: leadLine,
      keySnippet: input.signals.snippet,
      relatedFiles: input.signals.relatedFiles,
      context,
      data: {
        evidence: input.signals.keywords,
      },
      suggestions,
    };
  },
};
