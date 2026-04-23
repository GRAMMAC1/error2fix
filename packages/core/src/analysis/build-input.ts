import os from 'node:os';
import {
  extractSignals,
  normalizeLogs,
  rankSignals,
  segmentLogs,
} from '../parser/index.js';
import type {
  CoreAnalysisInput,
  CoreErrorSignalSet,
  CoreRawCapture,
  CoreWorkspaceSnapshot,
} from '../types/core.js';
import type { LatestRawCapture } from '../types/metadata.js';
import { fileExists } from '../utils/fs.js';
import { detectGitBranch } from '../utils/git.js';

const WORKSPACE_CANDIDATE_FILES = [
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'vite.config.js',
  'next.config.js',
  'next.config.mjs',
  'turbo.json',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'go.mod',
  'go.work',
  'Cargo.toml',
  'composer.json',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
];

async function buildWorkspaceSnapshot(
  cwd: string,
): Promise<CoreWorkspaceSnapshot> {
  const matches = await Promise.all(
    WORKSPACE_CANDIDATE_FILES.map(async (file) =>
      (await fileExists(`${cwd}/${file}`)) ? file : null,
    ),
  );
  const files = matches.filter((file): file is string => file !== null);
  const gitBranch = await detectGitBranch(cwd);
  return {
    cwd,
    root: cwd,
    files: [...new Set(files)],
    git: {
      branch: gitBranch,
    },
  };
}

function buildRawCapture(capture: LatestRawCapture): CoreRawCapture {
  return {
    metadata: {
      command: capture.metadata.command,
      exitCode: capture.metadata.exitCode,
      cwd: capture.metadata.cwd,
      shell: capture.metadata.shell,
      timestamp: capture.metadata.timestamp,
    },
    host: {
      os: {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
      },
      shell: capture.metadata.shell,
    },
    stdout: capture.stdout,
    stderr: capture.stderr,
    stdoutLogFile: capture.stdoutLogFile,
    stderrLogFile: capture.stderrLogFile,
  };
}

function buildCoreSignals(capture: LatestRawCapture): CoreErrorSignalSet {
  const normalized = normalizeLogs({
    stdout: capture.stdout,
    stderr: capture.stderr,
  });
  const segmented = segmentLogs(normalized);
  const extracted = extractSignals(segmented);
  const ranked = rankSignals(extracted);

  return {
    snippet: ranked.snippet,
    stackLines: ranked.stackLines,
    relatedFiles: ranked.relatedFiles,
    keywords: ranked.keywords,
  };
}

export async function buildCoreAnalysisInput(
  capture: LatestRawCapture,
): Promise<CoreAnalysisInput> {
  return {
    capture: buildRawCapture(capture),
    workspace: await buildWorkspaceSnapshot(capture.metadata.cwd),
    signals: buildCoreSignals(capture),
  };
}
