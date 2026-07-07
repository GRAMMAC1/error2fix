export type FailureEvidenceSource =
  | 'compiler'
  | 'runtime'
  | 'dependency'
  | 'generic';

export interface FailureEvidence {
  id: string;
  ruleId: string;
  source: FailureEvidenceSource;
  category: string;
  framework?: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  rawLine?: number;
  confidence: number;
  priority: number;
  snippet?: string;
}

export interface FailureEvidencePluginData {
  evidences: FailureEvidence[];
}

export function hasFailureEvidenceData(
  data: unknown,
): data is FailureEvidencePluginData {
  return (
    typeof data === 'object' &&
    data !== null &&
    Array.isArray((data as { evidences?: unknown }).evidences)
  );
}

export function formatEvidenceLocation(
  evidence: Pick<FailureEvidence, 'file' | 'line' | 'column'>,
): string | undefined {
  if (!evidence.file) {
    return undefined;
  }
  if (evidence.line && evidence.column) {
    return `${evidence.file}:${evidence.line}:${evidence.column}`;
  }
  if (evidence.line) {
    return `${evidence.file}:${evidence.line}`;
  }
  return evidence.file;
}

export function formatEvidenceSummary(evidence: FailureEvidence): string {
  const source = formatEvidenceLabel(evidence.framework ?? evidence.source);
  const category = evidence.category.replaceAll('_', ' ');
  const location = formatEvidenceLocation(evidence);
  const prefix = location
    ? `${source} ${category} in ${location}`
    : `${source} ${category}`;

  return `${prefix}: ${evidence.message}`;
}

function formatEvidenceLabel(label: string): string {
  switch (label.toLowerCase()) {
    case 'typescript':
      return 'TypeScript';
    case 'react':
      return 'React';
    case 'vue':
      return 'Vue';
    case 'svelte':
      return 'Svelte';
    case 'next':
      return 'Next';
    case 'nuxt':
      return 'Nuxt';
    default:
      return label;
  }
}
