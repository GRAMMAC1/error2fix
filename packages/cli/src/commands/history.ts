import { listSessions } from '@error2fix/core';
import type { CliFlags } from '../types.js';
import { formatHistory, formatJsonPayload } from '../utils/format.js';

export async function runHistoryCommand(
  flags: CliFlags,
  limit = 10,
): Promise<string> {
  const sessions = await listSessions(limit);
  return flags.json
    ? formatJsonPayload(sessions)
    : formatHistory(sessions, flags.color ?? true);
}
