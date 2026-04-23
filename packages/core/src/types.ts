export type SupportedShell = 'zsh' | 'bash' | 'fish' | 'unknown';

export interface CliFlags {
  json?: boolean;
  color?: boolean;
  debug?: boolean;
}

export interface RawCaptureMetadata {
  command: string;
  exitCode: number;
  cwd: string;
  shell: SupportedShell;
  timestamp: string;
}

export interface LatestRawCapture {
  metadata: RawCaptureMetadata;
  stdout: string;
  stderr: string;
  stdoutLogFile: string;
  stderrLogFile: string;
}
