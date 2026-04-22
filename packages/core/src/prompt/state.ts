import { z } from 'zod';
import type {
  ErrorCategory,
  FailureSession,
  ProjectContext,
} from '../types.js';

const commandStateSchema = z.object({
  raw: z.string(),
  argv: z.array(z.string()).optional(),
  cwd: z.string(),
  shell: z.string().optional(),
  timestamp: z.string(),
});

const hostStateSchema = z
  .object({
    os: z.string().optional(),
    arch: z.string().optional(),
    runtime: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
  })
  .optional();

const failureStateSchema = z.object({
  exitCode: z.number().int(),
  signal: z.string().optional(),
  category: z
    .enum(['compile', 'runtime', 'test', 'dependency', 'config', 'unknown'])
    .optional(),
  summary: z.string().optional(),
});

const errorStateSchema = z.object({
  snippet: z.string().optional(),
  stack: z.array(z.string()).optional(),
  files: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
});

const goalStateSchema = z.object({
  ask: z.array(
    z.enum(['root_cause', 'explanation', 'fix_steps', 'files_to_inspect']),
  ),
});

export const promptStateSchema = z.object({
  command: commandStateSchema,
  host: hostStateSchema,
  failure: failureStateSchema,
  error: errorStateSchema,
  goal: goalStateSchema,
});

export type PromptState = z.infer<typeof promptStateSchema>;

function inferFailureCategory(
  category: ErrorCategory | undefined,
): PromptState['failure']['category'] {
  switch (category) {
    case 'dependency_install':
      return 'dependency';
    case 'build_failure':
    case 'typescript_error':
      return 'compile';
    case 'test_failure':
      return 'test';
    case 'runtime_error':
      return 'runtime';
    default:
      return 'unknown';
  }
}

function normalizePathCandidate(candidate: string): string {
  return candidate
    .trim()
    .replace(/[):,]+$/g, '')
    .replace(/:\d+(?::\d+)?$/g, '');
}

export function extractKeywords(input: string): string[] {
  const matches = new Set<string>();
  const patterns = [
    /\bTS\d{3,5}\b/g,
    /\bERR_[A-Z0-9_]+\b/g,
    /\b[A-Z][a-zA-Z]+Error\b/g,
    /\bCannot find module\b/g,
    /\bMissing script\b/g,
    /\bfailed\b/gi,
  ];

  for (const pattern of patterns) {
    for (const match of input.matchAll(pattern)) {
      matches.add(match[0]);
    }
  }

  return Array.from(matches).slice(0, 8);
}

export function extractStackLines(input: string): string[] {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .filter(
      (line) =>
        /\bat\s.+\(.+:\d+:\d+\)/.test(line) ||
        /\b\S+\.(ts|tsx|js|jsx|go|rs|php|vue|c|cc|cpp|h|hpp):\d+(?::\d+)?\b/.test(
          line,
        ) ||
        /^#\d+\s/.test(line),
    )
    .slice(0, 8);
}

export function extractRelatedFiles(input: string): string[] {
  const matches = new Set<string>();
  const filePattern =
    /(?:^|[\s("'`])((?:\.{0,2}\/)?(?:[\w@%+=:,.-]+\/)*[\w@%+=,.-]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|go|rs|php|vue|yaml|yml|toml|ini|env))(?:[:(]\d+(?::\d+)?)?/g;

  for (const match of input.matchAll(filePattern)) {
    const candidate = normalizePathCandidate(match[1] ?? '');
    if (candidate.length > 0) {
      matches.add(candidate);
    }
  }

  return Array.from(matches).slice(0, 12);
}

function buildRuntimeList(
  session: FailureSession,
  context: ProjectContext,
): string[] {
  const runtime = new Set<string>();
  if (session.env.nodeVersion) {
    runtime.add(`node@${session.env.nodeVersion.replace(/^v/, '')}`);
  }
  const packageManager =
    context.packageJson?.packageManager ?? session.env.packageManager;
  if (packageManager && packageManager !== 'unknown') {
    runtime.add(packageManager);
  }
  return Array.from(runtime);
}

export function buildPromptState(
  session: FailureSession,
  context: ProjectContext,
  options?: {
    category?: ErrorCategory;
    summary?: string;
    errorText?: string;
  },
): PromptState {
  const errorText =
    options?.errorText?.trim() ||
    session.stderrSnippet ||
    session.stdoutSnippet;

  return promptStateSchema.parse({
    command: {
      raw: session.command,
      cwd: session.cwd,
      shell: session.shell,
      timestamp: session.timestamp,
    },
    host: {
      os: session.env.os || undefined,
      runtime: buildRuntimeList(session, context),
    },
    failure: {
      exitCode: session.exitCode,
      category: inferFailureCategory(options?.category),
      summary: options?.summary,
    },
    error: {
      snippet: errorText || undefined,
      stack: errorText ? extractStackLines(errorText) : undefined,
      files: errorText ? extractRelatedFiles(errorText) : undefined,
      keywords: errorText ? extractKeywords(errorText) : undefined,
    },
    goal: {
      ask: ['root_cause', 'explanation', 'fix_steps', 'files_to_inspect'],
    },
  });
}
