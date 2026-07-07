import type {
  FailureEvidence,
  FailureEvidenceSource,
} from '../diagnosis/evidence.js';
import type { CoreAnalysisInput } from '../types/core.js';
import {
  normalizeDiagnosticMessage,
  readAnalysisLogText,
  unique,
} from '../utils/text.js';

export interface RegexRule {
  id: string;
  source: FailureEvidenceSource;
  category: string;
  framework?: string;
  pattern: RegExp;
  priority: number;
  confidence?: number;
  filePattern?: RegExp;
}

const SOURCE_FILE_PATTERN =
  /\.(vue|svelte|astro|ts|tsx|js|jsx|mjs|cjs|css|scss)$/;

export function isProjectSourceFile(file: string): boolean {
  return (
    SOURCE_FILE_PATTERN.test(file) && !/node_modules|dist|build/.test(file)
  );
}

export function firstRelatedSourceFile(
  input: CoreAnalysisInput,
  preferredPattern?: RegExp,
): string | undefined {
  return (
    input.signals.relatedFiles.find((file) => preferredPattern?.test(file)) ??
    input.signals.relatedFiles.find(isProjectSourceFile)
  );
}

export function lineNumberForIndex(text: string, index: number): number {
  return text.slice(0, index).split(/\r?\n/).length;
}

export function snippetFromLine(
  text: string,
  rawLine: number | undefined,
  length = 3,
): string | undefined {
  if (!rawLine) {
    return undefined;
  }

  return text
    .split(/\r?\n/)
    .slice(rawLine - 1, rawLine - 1 + length)
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

export function matchRegexRules(
  input: CoreAnalysisInput,
  rules: RegexRule[],
): FailureEvidence[] {
  const text = readAnalysisLogText(input);
  const evidences: FailureEvidence[] = [];

  for (const rule of rules) {
    const pattern = toGlobalPattern(rule.pattern);
    for (const match of text.matchAll(pattern)) {
      const message = normalizeDiagnosticMessage(match[0]);
      if (!message) {
        continue;
      }

      const rawLine = lineNumberForIndex(text, match.index ?? 0);
      const file =
        match.groups?.file ?? firstRelatedSourceFile(input, rule.filePattern);

      evidences.push({
        id: `${rule.id}:${rawLine}:${evidences.length}`,
        ruleId: rule.id,
        source: rule.source,
        category: rule.category,
        framework: rule.framework,
        message,
        file,
        rawLine,
        confidence: rule.confidence ?? 70,
        priority: rule.priority,
        snippet: snippetFromLine(text, rawLine),
      });
    }
  }

  return unique(
    evidences.map((evidence) =>
      JSON.stringify({
        ...evidence,
        id: undefined,
      }),
    ),
  ).map((evidence, index) => ({
    ...(JSON.parse(evidence) as FailureEvidence),
    id: `regex:${index}`,
  }));
}

function toGlobalPattern(pattern: RegExp): RegExp {
  return pattern.global
    ? pattern
    : new RegExp(pattern.source, `${pattern.flags}g`);
}
