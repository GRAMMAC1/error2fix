export type {
  CliFlags,
  Diagnosis,
  ErrorCategory,
  ExplainResult,
  FailureSession,
  ProjectContext,
  SupportedShell,
} from './types.js';

export {
  buildProjectContext,
  readLogFile,
} from './context/project.js';
export { categorizeFromCommand } from './parsers/category.js';
export { parseLogContent } from './parsers/logfile.js';
export {
  buildDiagnosis,
  buildPrompt,
} from './prompt/generator.js';
export {
  buildPromptState,
  extractKeywords,
  extractRelatedFiles,
  extractStackLines,
  promptStateSchema,
} from './prompt/state.js';
export { buildSession, captureFailureSession } from './session/capture.js';
export { failureSessionSchema } from './session/schema.js';
export {
  ensureE2FDirs,
  listSessions,
  loadCapturedOutput,
  loadLatestSession,
  saveSession,
} from './session/store.js';
export { detectPackageManager } from './utils/env.js';
export { fileExists, readJsonFile } from './utils/fs.js';
export { shortHash } from './utils/hash.js';
export { toJson } from './utils/json.js';
export type { E2FPaths } from './utils/paths.js';
export { getE2FPaths } from './utils/paths.js';
