import {
  type CliFlags,
  type CoreAnalysis,
  diagnoseCapture,
  loadLatestRawCapture,
} from '@error2fix/core';
import { formatDiagnosis, formatJsonPayload } from '../utils/format.js';

export async function buildLatestFailureResult(): Promise<CoreAnalysis> {
  const capture = await loadLatestRawCapture();
  if (!capture) {
    throw new Error(
      'No failure session found. Run `e2f init`, let a command fail, then run `e2f`.',
    );
  }
  return diagnoseCapture(capture);
}

export async function runFixCommand(flags: CliFlags): Promise<string> {
  const result = await buildLatestFailureResult();
  return flags.json
    ? formatJsonPayload(result)
    : formatDiagnosis(result, flags.color ?? true);
}
