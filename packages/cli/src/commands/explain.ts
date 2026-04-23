import path from 'node:path';
import {
  buildProjectContext,
  diagnoseCapture,
  readLogFile,
} from '@error2fix/core';
import type { CliFlags, ExplainResult } from '../types.js';
import { formatDiagnosis, formatJsonPayload } from '../utils/format.js';

export async function explainLogFile(logFile: string): Promise<ExplainResult> {
  const absoluteLogFile = path.resolve(logFile);
  const logContent = await readLogFile(absoluteLogFile);
  const cwd = path.dirname(absoluteLogFile);
  const context = await buildProjectContext(cwd);
  return diagnoseCapture(
    {
      metadata: {
        command: `explain ${path.basename(logFile)}`,
        exitCode: 1,
        cwd,
        shell: 'unknown',
        timestamp: new Date().toISOString(),
      },
      stdout: '',
      stderr: logContent,
      stdoutLogFile: absoluteLogFile,
      stderrLogFile: absoluteLogFile,
    },
    context,
  );
}

export async function runExplainCommand(
  logFile: string,
  flags: CliFlags,
): Promise<string> {
  const result = await explainLogFile(logFile);
  return flags.json
    ? formatJsonPayload(result)
    : formatDiagnosis(result, flags.color ?? true);
}
