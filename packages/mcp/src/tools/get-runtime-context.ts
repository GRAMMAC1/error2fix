import {
  DEFAULT_RUNTIME_CONTEXT_SECTIONS,
  SAFE_ENV_KEY_PATTERN,
  SECRET_ENV_KEY_PATTERN,
} from '../constants/index.js';
import { resolveBriefSession } from '../store/brief-session-store.js';
import { getRuntimeContextResultSchema } from './tool-protocol.js';
import type {
  GetRuntimeContextArgs,
  GetRuntimeContextResult,
  RuntimeContextSection,
} from './tool-protocol.js';

function shouldInclude(
  requestedSections: Set<RuntimeContextSection>,
  section: RuntimeContextSection,
): boolean {
  return requestedSections.has(section);
}

function isSafeEnvKey(key: string): boolean {
  return SAFE_ENV_KEY_PATTERN.test(key) && !SECRET_ENV_KEY_PATTERN.test(key);
}

function buildSafeEnv(
  env: Record<string, string> | undefined,
  envKeys: string[] | undefined,
): {
  safeEnv?: Record<string, string>;
  redactions?: Array<{
    key: string;
    reason: 'secret_like' | 'not_allowlisted' | 'too_large';
  }>;
} {
  if (!env) {
    return {};
  }

  const keys = envKeys ?? Object.keys(env).filter(isSafeEnvKey);
  const safeEnv: Record<string, string> = {};
  const redactions: Array<{
    key: string;
    reason: 'secret_like' | 'not_allowlisted' | 'too_large';
  }> = [];

  for (const key of keys) {
    if (!(key in env)) {
      continue;
    }
    if (SECRET_ENV_KEY_PATTERN.test(key)) {
      redactions.push({ key, reason: 'secret_like' });
      continue;
    }
    if (!isSafeEnvKey(key)) {
      redactions.push({ key, reason: 'not_allowlisted' });
      continue;
    }
    const value = env[key] ?? '';
    if (value.length > 500) {
      redactions.push({ key, reason: 'too_large' });
      continue;
    }
    safeEnv[key] = value;
  }

  return {
    safeEnv: Object.keys(safeEnv).length > 0 ? safeEnv : undefined,
    redactions: redactions.length > 0 ? redactions : undefined,
  };
}

export async function getRuntimeContext(
  args: GetRuntimeContextArgs = {},
): Promise<GetRuntimeContextResult> {
  const session = resolveBriefSession(args.sessionId);
  if (!session) {
    return getRuntimeContextResultSchema.parse({
      ok: false,
      error: {
        code: 'NO_FAILURE_SESSION',
        message:
          'No brief session context is available. Call e2f_get_latest_failure_brief first, or pass a valid sessionId.',
      },
    });
  }

  const requestedSections = new Set(
    args.include ?? DEFAULT_RUNTIME_CONTEXT_SECTIONS,
  );
  const safeEnvResult = shouldInclude(requestedSections, 'safe_env')
    ? buildSafeEnv(session.input.capture.host.env, args.envKeys)
    : {};

  return getRuntimeContextResultSchema.parse({
    ok: true,
    sessionId: session.sessionId,
    contextSource: 'client_provided',
    command: shouldInclude(requestedSections, 'command')
      ? {
          raw: session.capture.metadata.command,
          cwd: session.capture.metadata.cwd,
          shell: session.capture.metadata.shell,
          exitCode: session.capture.metadata.exitCode,
          source: 'client_provided',
        }
      : undefined,
    os: shouldInclude(requestedSections, 'os')
      ? {
          ...session.input.capture.host.os,
          source: 'client_provided',
        }
      : undefined,
    shell: shouldInclude(requestedSections, 'shell')
      ? session.capture.metadata.shell
      : undefined,
    workspace: shouldInclude(requestedSections, 'workspace')
      ? {
          cwd: session.input.workspace.cwd,
          root: session.input.workspace.root,
          detectedFiles: session.input.workspace.files,
          source: 'client_provided',
        }
      : undefined,
    git: shouldInclude(requestedSections, 'git')
      ? {
          branch: session.input.workspace.git?.branch,
          source: 'client_provided',
        }
      : undefined,
    ...safeEnvResult,
  });
}
