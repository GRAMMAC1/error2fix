import type { CoreAnalysisInput } from './core.js';

/**
 * Stable identity metadata for a plugin package.
 */
export interface PluginMeta {
  /**
   * Unique plugin identifier, for example `plugin-ts` or `plugin-java`.
   */
  name: string;

  /**
   * Plugin version string when exposed by the package.
   */
  version?: string;

  /**
   * Human-readable plugin name for UI or logs.
   */
  displayName?: string;
}

/**
 * A typed context block contributed by a plugin.
 */
export interface PluginContextEntry<T> {
  /**
   * Plugin identifier that produced this context block.
   */
  plugin: string;

  /**
   * Context block kind, such as `runtime`, `config`, or `build-tool`.
   */
  kind: string;

  /**
   * Arbitrary plugin-specific payload.
   */
  data: T;
}

/**
 * Standard result shape returned by a plugin analysis step.
 */
export interface PluginResult<TContext, TData> {
  /**
   * Plugin identifier that produced this result.
   */
  plugin: string;

  /**
   * Whether the plugin matched and produced a meaningful analysis.
   * Default: `false` when the plugin determines it does not apply.
   */
  matched: boolean;

  /**
   * Short plugin-specific analysis summary.
   */
  summary?: string;

  /**
   * Best plugin-specific snippet to surface.
   */
  keySnippet?: string;

  /**
   * Files the plugin considers most relevant.
   * Default: empty array when the plugin does not identify files.
   */
  relatedFiles?: string[];

  /**
   * Optional structured context collected by the plugin before analysis.
   */
  context?: TContext;

  /**
   * Optional plugin-specific result payload.
   */
  data?: TData;

  /**
   * Plugin-specific suggestions or follow-up steps.
   * Default: empty array when the plugin has no suggestions.
   */
  suggestions?: string[];
}

/**
 * Contract implemented by language or ecosystem plugins.
 */
export interface Error2FixPlugin<TContext, TResult> {
  /**
   * Static metadata describing the plugin.
   */
  meta: PluginMeta;

  /**
   * Determines whether the plugin applies to the current analysis input.
   */
  detect(input: CoreAnalysisInput): boolean | Promise<boolean>;

  /**
   * Collects plugin-specific context after detection succeeds.
   */
  collectContext?(input: CoreAnalysisInput): TContext | Promise<TContext>;

  /**
   * Produces the final plugin analysis result.
   */
  analyze(
    input: CoreAnalysisInput,
    context?: TContext,
  ): PluginResult<TContext, TResult> | Promise<PluginResult<TContext, TResult>>;
}

/**
 * Ordered list of plugins available to the analysis pipeline.
 * Default: empty array when no plugins are registered.
 */
export type PluginRegistry = Error2FixPlugin<unknown, unknown>[];
