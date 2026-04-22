import path from 'node:path';
import {
  buildDiagnosis,
  buildProjectContext,
  buildSession,
  parseLogContent,
  readLogFile,
} from '@error2fix/core';
import type { CliFlags, ExplainResult } from '../types.js';
import { formatDiagnosis, formatJsonPayload } from '../utils/format.js';

export async function explainLogFile(logFile: string): Promise<ExplainResult> {
  const absoluteLogFile = path.resolve(logFile);
  const logContent = await readLogFile(absoluteLogFile);
  const parsed = parseLogContent(logContent);
  const cwd = path.dirname(absoluteLogFile);
  const context = await buildProjectContext(cwd);
  const session = buildSession({
    command: `explain ${path.basename(logFile)}`,
    exitCode: 1,
    cwd,
    shell: 'unknown',
    stderrSnippet: parsed.keySnippet,
    timestamp: new Date().toISOString(),
    projectType: context.projectType,
  });
  const diagnosis = buildDiagnosis(
    session,
    context,
    parsed.category,
    parsed.summary,
    parsed.keySnippet,
  );
  return { session, context, diagnosis };
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
