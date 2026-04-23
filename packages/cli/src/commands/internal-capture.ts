import { persistLatestRawCapture } from '@error2fix/core';
import type { SupportedShell } from '../types.js';
import { formatJsonPayload } from '../utils/format.js';

export interface CaptureOptions {
  command: string;
  exitCode: number;
  cwd: string;
  shell: SupportedShell;
  timestamp?: string;
  stdoutLog?: string;
  stderrLog?: string;
}

export async function runInternalCaptureCommand(
  options: CaptureOptions,
): Promise<string> {
  const result = await persistLatestRawCapture({
    command: options.command,
    exitCode: options.exitCode,
    cwd: options.cwd,
    shell: options.shell,
    timestamp: options.timestamp,
    stdoutLogFile: options.stdoutLog,
    stderrLogFile: options.stderrLog,
  });
  return formatJsonPayload(result);
}
