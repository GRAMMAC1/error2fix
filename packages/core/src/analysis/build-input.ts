import os from 'node:os';
import type { ProjectContext } from '../context/project.js';
import {
  extractSignals,
  normalizeLogs,
  rankSignals,
  segmentLogs,
} from '../log-parser/index.js';
import type {
  CoreAnalysisInput,
  CoreErrorSignalSet,
  CoreRawCapture,
  CoreWorkspaceSnapshot,
} from '../types/core.js';
import type { LatestRawCapture } from '../types/metadata.js';

function buildWorkspaceSnapshot(
  context: ProjectContext,
): CoreWorkspaceSnapshot {
  const files = [
    ...(context.packageJson ? ['package.json'] : []),
    ...context.lockfiles,
    ...context.configFiles,
  ];

  return {
    cwd: context.cwd,
    root: context.cwd,
    files: [...new Set(files)],
    git: {
      branch: context.gitBranch,
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

export function buildCoreAnalysisInput(
  capture: LatestRawCapture,
  context: ProjectContext,
): CoreAnalysisInput {
  return {
    capture: buildRawCapture(capture),
    workspace: buildWorkspaceSnapshot(context),
    signals: buildCoreSignals(capture),
  };
}
