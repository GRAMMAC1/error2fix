import type { CoreAnalysisInput } from '../types/core.js';
import type { Error2FixPlugin } from '../types/plugin.js';

function hasJavaSignal(input: CoreAnalysisInput): boolean {
  return (
    input.signals.relatedFiles.some((file) =>
      /\.(java|kt|kts|scala|gradle|properties|xml)$/.test(file),
    ) ||
    input.signals.keywords.some((keyword) =>
      /Exception$|Error$/.test(keyword),
    ) ||
    input.signals.stackLines.some((line) => /\bat\s+[\w$.]+\(/.test(line))
  );
}

export const javaPlugin: Error2FixPlugin<
  {
    buildFiles: string[];
  },
  {
    exceptionNames: string[];
  }
> = {
  meta: {
    name: 'builtin-java',
    displayName: 'Java',
  },
  detect(input) {
    return hasJavaSignal(input);
  },
  collectContext(input) {
    return {
      buildFiles: input.workspace.files.filter((file) =>
        /^(pom\.xml|build\.gradle|build\.gradle\.kts|settings\.gradle|settings\.gradle\.kts)$/.test(
          file,
        ),
      ),
    };
  },
  analyze(input, context) {
    const exceptionNames = input.signals.keywords.filter((keyword) =>
      /Exception$|Error$/.test(keyword),
    );

    return {
      plugin: 'builtin-java',
      matched: true,
      summary: exceptionNames[0]
        ? `Java exception detected (${exceptionNames[0]}).`
        : 'Java stack trace detected in the captured logs.',
      keySnippet: input.signals.snippet,
      relatedFiles: input.signals.relatedFiles.filter((file) =>
        /\.(java|kt|kts|scala|xml|properties|gradle)$/.test(file),
      ),
      context,
      data: {
        exceptionNames,
      },
      suggestions: [
        'Start from the first application stack frame instead of framework-internal frames.',
        'Inspect the referenced Java source file and surrounding business rule checks.',
        'Check build and runtime configuration if the exception depends on environment or classpath setup.',
      ],
    };
  },
};
