import type { CliFlags } from '@error2fix/core';
import { initializeShellIntegration } from '../shell/install.js';
import { formatChangedFiles, formatJsonPayload } from '../utils/format.js';

export async function runInitCommand(flags: CliFlags): Promise<string> {
  const result = await initializeShellIntegration();
  return flags.json
    ? formatJsonPayload(result)
    : formatChangedFiles(result, flags.color ?? true);
}
