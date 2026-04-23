import type { CoreAnalysisInput } from '../types/core.js';
import type { Error2FixPlugin } from '../types/plugin.js';

function hasTypeScriptSignal(input: CoreAnalysisInput): boolean {
  return (
    input.signals.keywords.some((keyword) => /^TS\d{3,5}$/.test(keyword)) ||
    input.signals.relatedFiles.some((file) => /\.(ts|tsx)$/.test(file)) ||
    input.workspace.files.some((file) => file === 'tsconfig.json')
  );
}

export const typescriptPlugin: Error2FixPlugin<
  {
    configFiles: string[];
  },
  {
    errorCodes: string[];
  }
> = {
  meta: {
    name: 'builtin-typescript',
    displayName: 'TypeScript',
  },
  detect(input) {
    return hasTypeScriptSignal(input);
  },
  collectContext(input) {
    return {
      configFiles: input.workspace.files.filter(
        (file) =>
          file === 'tsconfig.json' ||
          file.startsWith('tsconfig.') ||
          /\.(ts|tsx)$/.test(file),
      ),
    };
  },
  analyze(input, context) {
    const errorCodes = input.signals.keywords.filter((keyword) =>
      /^TS\d{3,5}$/.test(keyword),
    );

    return {
      plugin: 'builtin-typescript',
      matched: true,
      summary:
        errorCodes.length > 0
          ? `TypeScript compiler error detected (${errorCodes.join(', ')}).`
          : 'TypeScript-related failure detected from log evidence.',
      keySnippet: input.signals.snippet,
      relatedFiles: input.signals.relatedFiles.filter((file) =>
        /\.(ts|tsx|mts|cts)$/.test(file),
      ),
      context,
      data: {
        errorCodes,
      },
      suggestions: [
        'Open the first referenced TypeScript file and inspect the reported line.',
        'Compare the offending type with the expected interface or generic constraint.',
        'Review tsconfig options if module resolution or JSX behavior looks suspicious.',
      ],
    };
  },
};
