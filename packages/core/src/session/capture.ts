import os from 'node:os';
import type { SupportedShell } from '../types/metadata.js';
import { detectPackageManager } from '../utils/env.js';
import { shortHash } from '../utils/hash.js';
import { type FailureSessionRecord, failureSessionSchema } from './schema.js';

export interface CaptureInput {
  command: string;
  exitCode: number;
  cwd: string;
  shell: SupportedShell;
  timestamp?: string;
  stdoutSnippet?: string;
  stderrSnippet?: string;
  stdoutLogFile?: string;
  stderrLogFile?: string;
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
    stdoutLogFile: input.stdoutLogFile || undefined,
    stderrLogFile: input.stderrLogFile || undefined,
    projectType: input.projectType ?? 'unknown',
    env: {
      os: `${os.platform()} ${os.release()}`,
      nodeVersion: process.version,
      packageManager: detectPackageManager(),
    },
  });
  return session;
}
