import type { RuntimeContextSection } from '../tools/tool-protocol.js';

export const DEFAULT_MAX_EVIDENCE = 3;
export const DEFAULT_MAX_SNIPPET_CHARS = 1200;
export const DEFAULT_MAX_EVIDENCE_SECTIONS = 5;
export const DEFAULT_MAX_CHARS_PER_EVIDENCE_SECTION = 1600;
export const EVIDENCE_CONTEXT_LINES = 3;

export const DEFAULT_RUNTIME_CONTEXT_SECTIONS: RuntimeContextSection[] = [
  'command',
  'os',
  'shell',
  'workspace',
  'git',
];

export const SAFE_ENV_KEY_PATTERN =
  /^(CI|NODE_ENV|npm_config_(registry|user_agent)|HTTP_PROXY|HTTPS_PROXY|NO_PROXY)$/i;
export const SECRET_ENV_KEY_PATTERN =
  /(token|secret|password|passwd|credential|cookie|key)$/i;

export const WORKFLOW_DESCRIPTION = [
  'Recommended workflow: call e2f_get_latest_failure_brief first.',
  'If next.canAnswerFromDiagnosis is true, answer without requesting raw logs.',
  'If more evidence is needed, call e2f_query_failure_evidence with evidence IDs or suggested queries from the diagnosis.',
  'Call e2f_get_runtime_context only when command, OS, shell, package manager, runtime versions, workspace, git, or safe environment details affect the fix.',
].join(' ');
