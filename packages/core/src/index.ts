export type {
  CliFlags,
  LatestRawCapture,
  RawCaptureMetadata,
  SupportedShell,
} from './types/metadata.js';
export type {
  CoreAnalysis,
  CoreAnalysisInput,
  CoreErrorSignalSet,
  CoreHostInfo,
  CorePromptGoal,
  CorePromptState,
  CoreRawCapture,
  CoreRawCaptureMetadata,
  CoreWorkspaceSnapshot,
} from './types/core.js';
export type {
  Error2FixPlugin,
  PluginContextEntry,
  PluginMeta,
  PluginRegistry,
  PluginResult,
} from './types/plugin.js';

export { aggregateCoreAnalysis } from './analysis/aggregate.js';
export { buildCoreAnalysisInput } from './analysis/build-input.js';
export { diagnoseCapture } from './analysis/diagnose.js';
export {
  extractSignals,
  normalizeLogs,
  rankSignals,
  segmentLogs,
} from './parser/index.js';
export {
  createPluginRegistry,
  getDefaultPluginRegistry,
  registerPlugin,
} from './plugin/registry.js';
export { runPlugins } from './plugin/run.js';
export { detectPackageManager } from './utils/env.js';
export { detectGitBranch } from './utils/git.js';
export { ensureE2FDirs, loadLatestRawCapture } from './utils/store.js';
export {
  fileExists,
  readJsonFile,
  readFileIfPresent,
  removeIfPresent,
} from './utils/fs.js';
export { shortHash } from './utils/hash.js';
export { toJson } from './utils/json.js';
export type { E2FPaths } from './utils/paths.js';
export { getE2FPaths } from './utils/paths.js';
