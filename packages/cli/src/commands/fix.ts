import {
  buildProjectContext,
  diagnoseCapture,
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
  const context = await buildProjectContext(capture.metadata.cwd);
  return diagnoseCapture(capture, context);
}

export async function runFixCommand(flags: CliFlags): Promise<string> {
  const result = await buildLatestFailureResult();
  return flags.json
    ? formatJsonPayload(result)
    : formatDiagnosis(result, flags.color ?? true);
}
