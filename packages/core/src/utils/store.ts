import fs from 'node:fs/promises';
import type {
  LatestRawCapture,
  RawCaptureMetadata,
} from '../types/metadata.js';
import { readFileIfPresent } from './fs.js';
import { type E2FPaths, getE2FPaths } from './paths.js';

const METADATA_PREFIX = '# e2f-meta ';

export async function ensureE2FDirs(paths = getE2FPaths()): Promise<E2FPaths> {
  await fs.mkdir(paths.homeDir, { recursive: true });
  await fs.mkdir(paths.logsDir, { recursive: true });
  await fs.mkdir(paths.cacheDir, { recursive: true });
  return paths;
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
