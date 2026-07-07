import {
  type FailureEvidence,
  formatEvidenceSummary,
  hasFailureEvidenceData,
} from '../diagnosis/evidence.js';
import { rankEvidence, reduceEvidence } from '../diagnosis/rank.js';
import type { CoreAnalysis, CoreAnalysisInput } from '../types/core.js';
import type { PluginResult } from '../types/plugin.js';
import { firstNonEmptyLine, uniqueNonEmptyStrings } from '../utils/text.js';

function collectEvidence(
  pluginResults: PluginResult<unknown, unknown>[],
): FailureEvidence[] {
  return pluginResults
    .filter((result) => result.matched && hasFailureEvidenceData(result.data))
    .flatMap((result) =>
      hasFailureEvidenceData(result.data) ? result.data.evidences : [],
    );
}

function buildSummary(
  input: CoreAnalysisInput,
  leadEvidence: FailureEvidence | undefined,
): string {
  return (
    (leadEvidence ? formatEvidenceSummary(leadEvidence) : undefined) ??
    firstNonEmptyLine(input.signals.snippet) ??
    firstNonEmptyLine(input.capture.stderr) ??
    firstNonEmptyLine(input.capture.stdout) ??
    `Command "${input.capture.metadata.command}" failed with exit code ${input.capture.metadata.exitCode}.`
  );
}

function buildLikelyCauses(
  input: CoreAnalysisInput,
  rankedEvidence: FailureEvidence[],
): string[] {
  const causes = rankedEvidence
    .filter((evidence) => evidence.source !== 'generic')
    .slice(0, 3)
    .map(formatEvidenceSummary);

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

  return uniqueNonEmptyStrings(causes).slice(0, 5);
}

function buildNextSteps(
  input: CoreAnalysisInput,
  rankedEvidence: FailureEvidence[],
): string[] {
  const leadEvidence = rankedEvidence[0];
  const firstFile = leadEvidence?.file ?? input.signals.relatedFiles[0];
  const genericSteps = [
    firstFile
      ? `Inspect ${firstFile} first.`
      : 'Inspect the first high-signal error line in stderr.',
  ];

  if (leadEvidence?.source === 'dependency') {
    genericSteps.push(
      'Check dependency installation, package exports, module format, and workspace aliases before chasing framework stack frames.',
    );
  } else if (leadEvidence?.source === 'runtime') {
    genericSteps.push(
      'Start from the first application component frame rather than framework internals.',
    );
  } else if (leadEvidence?.source === 'compiler') {
    genericSteps.push(
      'Fix the earliest precise compiler diagnostic before chasing later cascade errors.',
    );
  } else if (input.signals.stackLines.length > 0) {
    genericSteps.push(
      'Trace the top stack frame back to the application code path.',
    );
  }

  return uniqueNonEmptyStrings(genericSteps).slice(0, 4);
}

export function aggregateCoreAnalysis(
  input: CoreAnalysisInput,
  pluginResults: PluginResult<unknown, unknown>[],
): CoreAnalysis {
  const rankedEvidence = rankEvidence(
    reduceEvidence(collectEvidence(pluginResults)),
  );
  const leadEvidence = rankedEvidence[0];

  return {
    host: input.capture.host,
    summary: buildSummary(input, leadEvidence),
    keySnippet: leadEvidence?.snippet ?? input.signals.snippet,
    likelyCauses: buildLikelyCauses(input, rankedEvidence),
    nextSteps: buildNextSteps(input, rankedEvidence),
    relatedFiles: uniqueNonEmptyStrings([
      ...rankedEvidence.flatMap((evidence) =>
        evidence.file ? [evidence.file] : [],
      ),
      ...input.signals.relatedFiles,
    ]).slice(0, 10),
    pluginResults,
  };
}
