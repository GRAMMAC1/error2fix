import fs from 'node:fs/promises';
import os from 'node:os';
import type { SupportedShell } from '../types.js';
import { detectPackageManager } from '../utils/env.js';
import { shortHash } from '../utils/hash.js';
import type { E2FPaths } from '../utils/paths.js';
import { type FailureSessionRecord, failureSessionSchema } from './schema.js';
import { saveSession } from './store.js';

const MAX_SNIPPET_CHARS = 4000;

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

async function readLogFile(filePath?: string): Promise<string> {
  if (!filePath) {
    return '';
  }

  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function toSnippet(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_SNIPPET_CHARS) {
    return trimmed;
  }
  return trimmed.slice(-MAX_SNIPPET_CHARS);
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

export async function captureFailureSession(
  input: CaptureInput,
  paths?: E2FPaths,
): Promise<FailureSessionRecord> {
  const [stdoutRaw, stderrRaw] = await Promise.all([
    readLogFile(input.stdoutLogFile),
    readLogFile(input.stderrLogFile),
  ]);
  const session = buildSession({
    ...input,
    stdoutSnippet: input.stdoutSnippet ?? toSnippet(stdoutRaw),
    stderrSnippet: input.stderrSnippet ?? toSnippet(stderrRaw),
  });
  await saveSession(session, paths);
  return session;
}
