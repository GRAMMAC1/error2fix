import fs from 'node:fs/promises';
import { ensureE2FDirs } from '../session/store.js';
import type { SupportedShell } from '../types.js';
import type { LatestRawCapture, RawCaptureMetadata } from '../types.js';
import { getE2FPaths } from '../utils/paths.js';

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

async function readFileIfPresent(filePath?: string): Promise<string> {
  if (!filePath) {
    return '';
  }

  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

async function removeIfPresent(filePath?: string): Promise<void> {
  if (!filePath) {
    return;
  }

  try {
    await fs.rm(filePath, { force: true });
  } catch {
    // Ignore cleanup failures for transient shell hook files.
  }
}

function serializeLog(metadata: RawCaptureMetadata, content: string): string {
  return `${METADATA_PREFIX}${JSON.stringify(metadata)}\n${content}`;
}

function parseLog(fileContent: string): {
  metadata: RawCaptureMetadata | null;
  content: string;
} {
  const [firstLine = '', ...rest] = fileContent.split(/\r?\n/);
  if (!firstLine.startsWith(METADATA_PREFIX)) {
    return {
      metadata: null,
      content: fileContent,
    };
  }

  try {
    return {
      metadata: JSON.parse(
        firstLine.slice(METADATA_PREFIX.length),
      ) as RawCaptureMetadata,
      content: rest.join('\n'),
    };
  } catch {
    return {
      metadata: null,
      content: rest.join('\n'),
    };
  }
}

export async function persistLatestRawCapture(
  input: PersistRawCaptureInput,
  paths = getE2FPaths(),
): Promise<PersistRawCaptureResult> {
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

export async function loadLatestRawCapture(
  paths = getE2FPaths(),
): Promise<LatestRawCapture | null> {
  const [stdoutFile, stderrFile] = await Promise.all([
    readFileIfPresent(paths.latestStdoutLogFile),
    readFileIfPresent(paths.latestStderrLogFile),
  ]);

  if (!stdoutFile && !stderrFile) {
    return null;
  }

  const stdoutParsed = parseLog(stdoutFile);
  const stderrParsed = parseLog(stderrFile);
  const metadata = stderrParsed.metadata ?? stdoutParsed.metadata;

  if (!metadata) {
    return null;
  }

  return {
    metadata,
    stdout: stdoutParsed.content,
    stderr: stderrParsed.content,
    stdoutLogFile: paths.latestStdoutLogFile,
    stderrLogFile: paths.latestStderrLogFile,
  };
}
