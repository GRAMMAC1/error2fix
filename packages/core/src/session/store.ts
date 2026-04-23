import fs from 'node:fs/promises';
import type { FailureSession } from '../types.js';
import { type E2FPaths, getE2FPaths } from '../utils/paths.js';

const MAX_ANALYSIS_CHARS = 12000;

async function readTextFile(filePath?: string): Promise<string> {
  if (!filePath) {
    return '';
  }

  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function clipForAnalysis(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_ANALYSIS_CHARS) {
    return trimmed;
  }
  return trimmed.slice(-MAX_ANALYSIS_CHARS);
}

export async function ensureE2FDirs(paths = getE2FPaths()): Promise<E2FPaths> {
  await fs.mkdir(paths.homeDir, { recursive: true });
  await fs.mkdir(paths.logsDir, { recursive: true });
  await fs.mkdir(paths.cacheDir, { recursive: true });
  return paths;
}

export async function loadCapturedOutput(
  session: Pick<
    FailureSession,
    'stdoutSnippet' | 'stderrSnippet' | 'stdoutLogFile' | 'stderrLogFile'
  >,
): Promise<{
  stdout: string;
  stderr: string;
  combined: string;
}> {
  const [stdoutLog, stderrLog] = await Promise.all([
    readTextFile(session.stdoutLogFile),
    readTextFile(session.stderrLogFile),
  ]);
  const stdout = stdoutLog || session.stdoutSnippet || '';
  const stderr = stderrLog || session.stderrSnippet || '';
  const combinedSource = stderr || stdout || '';

  return {
    stdout,
    stderr,
    combined: clipForAnalysis(combinedSource),
  };
}
