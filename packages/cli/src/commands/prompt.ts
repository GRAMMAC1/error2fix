import type { CliFlags } from '../types.js';
import { formatJsonPayload } from '../utils/format.js';
import { buildLatestFailureResult } from './fix.js';

export async function runPromptCommand(flags: CliFlags): Promise<string> {
  const result = await buildLatestFailureResult();
  return flags.json
    ? formatJsonPayload({ prompt: result.diagnosis.prompt })
    : result.diagnosis.prompt;
}
