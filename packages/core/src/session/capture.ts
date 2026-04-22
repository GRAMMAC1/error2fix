import os from 'node:os';
import type { SupportedShell } from '../types.js';
import { detectPackageManager } from '../utils/env.js';
import { shortHash } from '../utils/hash.js';
import { type FailureSessionRecord, failureSessionSchema } from './schema.js';
import { saveSession } from './store.js';

export interface CaptureInput {
  command: string;
  exitCode: number;
  cwd: string;
  shell: SupportedShell;
  timestamp?: string;
  stdoutSnippet?: string;
  stderrSnippet?: string;
  projectType?: string;
}

export function buildSession(input: CaptureInput): FailureSessionRecord {
  const timestamp = input.timestamp ?? new Date().toISOString();
  const id = `${timestamp.replace(/[:.]/g, '-')}-${shortHash(`${input.command}:${timestamp}:${input.cwd}`)}`;
  const session = failureSessionSchema.parse({
    id,
    command: input.command,
    exitCode: input.exitCode,
    cwd: input.cwd,
    shell: input.shell,
    timestamp,
    stdoutSnippet: input.stdoutSnippet ?? '',
    stderrSnippet: input.stderrSnippet ?? '',
    projectType: input.projectType ?? 'unknown',
    env: {
      os: `${os.platform()} ${os.release()}`,
      nodeVersion: process.version,
      packageManager: detectPackageManager(),
    },
  });
  return session;
}

export async function captureFailureSession(
  input: CaptureInput,
): Promise<FailureSessionRecord> {
  const session = buildSession(input);
  await saveSession(session);
  return session;
}
