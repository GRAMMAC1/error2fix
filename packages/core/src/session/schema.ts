import { z } from 'zod';

export const failureSessionSchema = z.object({
  id: z.string(),
  command: z.string(),
  exitCode: z.number().int(),
  cwd: z.string(),
  shell: z.enum(['zsh', 'bash', 'fish', 'unknown']),
  timestamp: z.string(),
  stdoutSnippet: z.string(),
  stderrSnippet: z.string(),
  stdoutLogFile: z.string().optional(),
  stderrLogFile: z.string().optional(),
  projectType: z.string(),
  env: z.object({
    os: z.string(),
    nodeVersion: z.string(),
    packageManager: z.string(),
  }),
});

export type FailureSessionRecord = z.infer<typeof failureSessionSchema>;
