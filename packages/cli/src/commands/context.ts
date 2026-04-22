import type { CliFlags } from '../types.js';
import { formatContext, formatJsonPayload } from '../utils/format.js';
import { buildLatestFailureResult } from './fix.js';

export async function runContextCommand(flags: CliFlags): Promise<string> {
  const result = await buildLatestFailureResult();
  return flags.json
    ? formatJsonPayload({ session: result.session, context: result.context })
    : formatContext(result.session, result.context, flags.color ?? true);
}
