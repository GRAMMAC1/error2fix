export type {
  CliFlags,
  Diagnosis,
  ErrorCategory,
  ExplainResult,
  FailureSession,
  LatestRawCapture,
  ProjectContext,
  RawCaptureMetadata,
  SupportedShell,
} from './types.js';

export {
  buildProjectContext,
  readLogFile,
} from './context/project.js';
export { categorizeFromCommand } from './parsers/category.js';
export { parseLogContent } from './parsers/logfile.js';
export {
  loadLatestRawCapture,
  persistLatestRawCapture,
} from './capture/store.js';
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
export { buildSession } from './session/capture.js';
export { failureSessionSchema } from './session/schema.js';
export {
  ensureE2FDirs,
  loadCapturedOutput,
} from './session/store.js';
export { detectPackageManager } from './utils/env.js';
export { fileExists, readJsonFile } from './utils/fs.js';
export { shortHash } from './utils/hash.js';
export { toJson } from './utils/json.js';
export type { E2FPaths } from './utils/paths.js';
export { getE2FPaths } from './utils/paths.js';
