import {
  buildDiagnosis,
  buildProjectContext,
  buildSession,
  loadLatestRawCapture,
} from '@error2fix/core';
import type { CliFlags, ExplainResult } from '../types.js';
import { formatDiagnosis, formatJsonPayload } from '../utils/format.js';

export async function buildLatestFailureResult(): Promise<ExplainResult> {
  const capture = await loadLatestRawCapture();
  if (!capture) {
    throw new Error(
      'No failure session found. Run `e2f init`, let a command fail, then run `e2f`.',
    );
  }
  const { metadata } = capture;
  const context = await buildProjectContext(metadata.cwd);
  const session = buildSession({
    command: metadata.command,
    exitCode: metadata.exitCode,
    cwd: metadata.cwd,
    shell: metadata.shell,
    timestamp: metadata.timestamp,
    stdoutLogFile: capture.stdoutLogFile,
    stderrLogFile: capture.stderrLogFile,
    projectType: context.projectType,
  });
  session.projectType = context.projectType;
  const diagnosis = buildDiagnosis(
    session,
    context,
    undefined,
    undefined,
    capture.stderr || capture.stdout,
  );
  return { session, context, diagnosis };
}

export async function runFixCommand(flags: CliFlags): Promise<string> {
  const result = await buildLatestFailureResult();
  return flags.json
    ? formatJsonPayload(result)
    : formatDiagnosis(result, flags.color ?? true);
}
