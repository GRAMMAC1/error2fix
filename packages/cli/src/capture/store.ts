import fs from 'node:fs/promises';
import {
  type RawCaptureMetadata,
  type SupportedShell,
  ensureE2FDirs,
  getE2FPaths,
  readFileIfPresent,
  removeIfPresent,
} from '@error2fix/core';

const METADATA_PREFIX = '# e2f-meta ';

export interface PersistRawCaptureInput {
  command: string;
  exitCode: number;
  cwd: string;
  shell: SupportedShell;
  timestamp?: string;
  stdoutLogFile?: string;
  stderrLogFile?: string;
}

export interface PersistRawCaptureResult {
  stdoutLogFile: string;
  stderrLogFile: string;
  timestamp: string;
}

function serializeLog(metadata: RawCaptureMetadata, content: string): string {
  return `${METADATA_PREFIX}${JSON.stringify(metadata)}\n${content}`;
}

export async function persistLatestRawCapture(
  input: PersistRawCaptureInput,
): Promise<PersistRawCaptureResult> {
  const paths = getE2FPaths();
  await ensureE2FDirs(paths);

  const metadata: RawCaptureMetadata = {
    command: input.command,
    exitCode: input.exitCode,
    cwd: input.cwd,
    shell: input.shell,
    timestamp: input.timestamp ?? new Date().toISOString(),
  };

  const [stdout, stderr] = await Promise.all([
    readFileIfPresent(input.stdoutLogFile),
    readFileIfPresent(input.stderrLogFile),
  ]);

  await Promise.all([
    fs.writeFile(
      paths.latestStdoutLogFile,
      serializeLog(metadata, stdout),
      'utf8',
    ),
    fs.writeFile(
      paths.latestStderrLogFile,
      serializeLog(metadata, stderr),
      'utf8',
    ),
  ]);

  await Promise.all([
    removeIfPresent(
      input.stdoutLogFile && input.stdoutLogFile !== paths.latestStdoutLogFile
        ? input.stdoutLogFile
        : undefined,
    ),
    removeIfPresent(
      input.stderrLogFile && input.stderrLogFile !== paths.latestStderrLogFile
        ? input.stderrLogFile
        : undefined,
    ),
  ]);

  return {
    stdoutLogFile: paths.latestStdoutLogFile,
    stderrLogFile: paths.latestStderrLogFile,
    timestamp: metadata.timestamp,
  };
}
