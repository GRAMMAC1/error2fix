export type LogSource = 'stdout' | 'stderr' | 'combined';

export interface RawLogInput {
  stdout: string;
  stderr: string;
}

export interface NormalizedLog {
  stdout: string;
  stderr: string;
  combined: string;
  stdoutLines: string[];
  stderrLines: string[];
  combinedLines: string[];
}

export interface LogSegment {
  id: string;
  source: LogSource;
  text: string;
  lines: string[];
  startLine: number;
  endLine: number;
}

export interface SegmentedLog {
  segments: LogSegment[];
}

export interface CandidateSnippet {
  text: string;
  source: LogSource;
  segmentId: string;
  startLine: number;
  endLine: number;
  score: number;
}

export interface ExtractedSignals {
  snippets: CandidateSnippet[];
  stackLines: string[];
  relatedFiles: string[];
  keywords: string[];
}

export interface RankedSignals {
  snippet?: string;
  stackLines: string[];
  relatedFiles: string[];
  keywords: string[];
}
