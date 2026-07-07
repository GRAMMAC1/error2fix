import type { CoreAnalysisInput } from '../types/core.js';

export function firstNonEmptyLine(
  text: string | undefined,
): string | undefined {
  return text
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
}

export function normalizeDiagnosticMessage(message: string): string {
  return message
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.;\s]+$/g, '.');
}

export function readAnalysisLogText(input: CoreAnalysisInput): string {
  return [input.capture.stderr, input.capture.stdout, input.signals.snippet]
    .filter(Boolean)
    .join('\n');
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function uniqueNonEmptyStrings(values: string[]): string[] {
  return unique(values.filter((value) => value.trim().length > 0));
}
