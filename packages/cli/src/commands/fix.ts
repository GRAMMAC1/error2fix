import {
  buildDiagnosis,
  buildProjectContext,
  loadLatestSession,
} from '@error2fix/core';
import type { CliFlags, ExplainResult } from '../types.js';
import { formatDiagnosis, formatJsonPayload } from '../utils/format.js';

export async function buildLatestFailureResult(): Promise<ExplainResult> {
  const session = await loadLatestSession();
  if (!session) {
    throw new Error(
      'No failure session found. Run `e2f init`, let a command fail, then run `e2f`.',
    );
  }
  const context = await buildProjectContext(session.cwd);
  session.projectType = context.projectType;
  const diagnosis = buildDiagnosis(
    session,
    context,
    undefined,
    undefined,
    session.stderrSnippet || session.stdoutSnippet,
  );
  return { session, context, diagnosis };
}

export async function runFixCommand(flags: CliFlags): Promise<string> {
  const result = await buildLatestFailureResult();
  return flags.json
    ? formatJsonPayload(result)
    : formatDiagnosis(result, flags.color ?? true);
}
