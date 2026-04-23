import type { SupportedShell } from '../types.js';

/**
 * Operating system details that are independent from any language runtime.
 */
export interface CoreOsInfo {
  /**
   * Host OS platform identifier such as `darwin`, `linux`, or `win32`.
   */
  platform: string;

  /**
   * Host OS release or kernel version when available.
   */
  release?: string;

  /**
   * CPU architecture such as `arm64` or `x64`.
   */
  arch?: string;
}

/**
 * Shell and host-level facts that are shared across all plugins.
 */
export interface CoreHostInfo {
  /**
   * Host operating system details.
   */
  os: CoreOsInfo;

  /**
   * Shell used by the captured command.
   */
  shell?: SupportedShell;

  /**
   * Optional environment variables that survived allowlist filtering.
   */
  env?: Record<string, string>;
}

/**
 * Metadata captured from the shell before any language-specific analysis begins.
 */
export interface CoreRawCaptureMetadata {
  /**
   * Original command text executed by the user.
   */
  command: string;

  /**
   * Process exit code reported by the shell.
   */
  exitCode: number;

  /**
   * Working directory where the command was executed.
   */
  cwd: string;

  /**
   * Shell that reported the failed command.
   */
  shell: SupportedShell;

  /**
   * UTC timestamp of the failed command.
   */
  timestamp: string;
}

/**
 * Raw failure capture before any structured extraction is applied.
 */
export interface CoreRawCapture {
  /**
   * Command-level metadata captured from the shell hook.
   */
  metadata: CoreRawCaptureMetadata;

  /**
   * Host details captured alongside the failure.
   */
  host: CoreHostInfo;

  /**
   * Raw standard output captured for the failed command.
   * Default: empty string when no stdout was captured.
   */
  stdout: string;

  /**
   * Raw standard error captured for the failed command.
   * Default: empty string when no stderr was captured.
   */
  stderr: string;

  /**
   * Absolute path to the persisted stdout log when one exists.
   */
  stdoutLogFile?: string;

  /**
   * Absolute path to the persisted stderr log when one exists.
   */
  stderrLogFile?: string;
}

/**
 * Minimal Git state that is safe to expose at the core layer.
 */
export interface CoreGitSnapshot {
  /**
   * Current Git branch name.
   * Default: `null` when the directory is not inside a Git repository.
   */
  branch?: string | null;
}

/**
 * Language-agnostic workspace facts collected before plugin-specific context.
 */
export interface CoreWorkspaceSnapshot {
  /**
   * Current working directory used for analysis.
   */
  cwd: string;

  /**
   * Detected workspace or repository root when one can be inferred.
   */
  root?: string;

  /**
   * Relevant file names or relative paths discovered in the workspace.
   * Default: empty array when no files were collected.
   */
  files: string[];

  /**
   * Minimal Git metadata for the workspace.
   */
  git?: CoreGitSnapshot;
}

/**
 * Error signals extracted with language-neutral heuristics.
 */
export interface CoreErrorSignalSet {
  /**
   * Short human-readable snippet that best represents the failure.
   */
  snippet?: string;

  /**
   * Stack lines or file/line markers extracted from the raw logs.
   * Default: empty array.
   */
  stackLines: string[];

  /**
   * Related files inferred from the raw logs.
   * Default: empty array.
   */
  relatedFiles: string[];

  /**
   * Stable keywords such as error codes or notable phrases.
   * Default: empty array.
   */
  keywords: string[];
}

/**
 * Shared analysis input that every plugin receives.
 */
export interface CoreAnalysisInput {
  /**
   * Raw failure capture and host details.
   */
  capture: CoreRawCapture;

  /**
   * Language-agnostic workspace snapshot.
   */
  workspace: CoreWorkspaceSnapshot;

  /**
   * Core-extracted error signals derived from the raw logs.
   */
  signals: CoreErrorSignalSet;
}

/**
 * Allowed high-level output sections requested from downstream diagnosis.
 */
export interface CorePromptGoal {
  /**
   * Ordered list of requested answer sections.
   * Default: `['root_cause', 'explanation', 'fix_steps', 'files_to_inspect']`
   * when the caller uses the current default prompt builder.
   */
  ask: Array<'root_cause' | 'explanation' | 'fix_steps' | 'files_to_inspect'>;
}

/**
 * Command facts rendered into prompt-ready form.
 */
export interface CorePromptCommandState {
  /**
   * Original raw command text.
   */
  raw: string;

  /**
   * Working directory where the command ran.
   */
  cwd: string;

  /**
   * Shell that ran the command.
   */
  shell?: SupportedShell;

  /**
   * UTC timestamp for the failure.
   */
  timestamp: string;

  /**
   * Process exit code reported by the shell.
   */
  exitCode: number;
}

/**
 * Prompt input shape shared by all plugin ecosystems.
 */
export interface CorePromptState {
  /**
   * Prompt-ready command facts.
   */
  command: CorePromptCommandState;

  /**
   * Host details that apply across ecosystems.
   */
  host: CoreHostInfo;

  /**
   * Workspace details that apply across ecosystems.
   */
  workspace: CoreWorkspaceSnapshot;

  /**
   * Error signals selected for prompt generation.
   */
  error: CoreErrorSignalSet;

  /**
   * Plugin-provided context blocks appended to the core prompt state.
   * Default: empty array when no plugin contributes context.
   */
  pluginContext: import('./plugin.js').PluginContextEntry<unknown>[];

  /**
   * Requested answer sections for the downstream model.
   */
  goal: CorePromptGoal;
}

/**
 * Aggregated analysis result before any ecosystem-specific rendering.
 */
export interface CoreAnalysis {
  /**
   * Host details carried forward into the final aggregated analysis result.
   */
  host: CoreHostInfo;

  /**
   * Short analysis summary produced by the core pipeline.
   */
  summary: string;

  /**
   * Best single snippet to show as the lead failure signal.
   */
  keySnippet?: string;

  /**
   * General-purpose likely causes inferred by the core pipeline.
   * Default: empty array.
   */
  likelyCauses: string[];

  /**
   * General-purpose next steps inferred by the core pipeline.
   * Default: empty array.
   */
  nextSteps: string[];

  /**
   * Files the user should inspect first.
   * Default: empty array.
   */
  relatedFiles: string[];

  /**
   * Per-plugin analysis results contributed by matching plugins.
   * Default: empty array.
   */
  pluginResults: import('./plugin.js').PluginResult<unknown, unknown>[];
}
