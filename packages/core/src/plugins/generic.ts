import type { FailureEvidence } from '../diagnosis/evidence.js';
import type { CoreAnalysisInput } from '../types/core.js';
import type { Error2FixPlugin } from '../types/plugin.js';
import {
  firstNonEmptyLine,
  normalizeDiagnosticMessage,
} from '../utils/text.js';

export const genericPlugin: Error2FixPlugin<
  {
    keywordCount: number;
    relatedFileCount: number;
  },
  {
    evidences: FailureEvidence[];
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

    const evidence: FailureEvidence = {
      id: 'generic:lead-line',
      ruleId: 'generic.lead-line',
      source: 'generic',
      category: 'generic_failure',
      message: normalizeDiagnosticMessage(leadLine),
      file: input.signals.relatedFiles[0],
      rawLine: 1,
      confidence: 30,
      priority: 20,
      snippet: input.signals.snippet,
    };

    return {
      plugin: 'builtin-generic',
      matched: true,
      summary: leadLine,
      keySnippet: input.signals.snippet,
      relatedFiles: input.signals.relatedFiles,
      context,
      data: {
        evidences: [evidence],
      },
    };
  },
};
