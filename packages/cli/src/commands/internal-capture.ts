import { captureFailureSession } from '@error2fix/core';
import type { SupportedShell } from '../types.js';
import { formatJsonPayload } from '../utils/format.js';

export interface CaptureOptions {
  command: string;
  exitCode: number;
  cwd: string;
  shell: SupportedShell;
  timestamp?: string;
}

export async function runInternalCaptureCommand(
  options: CaptureOptions,
): Promise<string> {
  const session = await captureFailureSession(options);
  return formatJsonPayload(session);
}
