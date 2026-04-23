import type { CoreAnalysisInput } from '../types/core.js';
import type {
  Error2FixPlugin,
  PluginRegistry,
  PluginResult,
} from '../types/plugin.js';

async function runPlugin(
  plugin: Error2FixPlugin<unknown, unknown>,
  input: CoreAnalysisInput,
): Promise<PluginResult<unknown, unknown>> {
  const matched = await plugin.detect(input);
  if (!matched) {
    return {
      plugin: plugin.meta.name,
      matched: false,
    };
  }

  const context = plugin.collectContext
    ? await plugin.collectContext(input)
    : undefined;
  const result = await plugin.analyze(input, context);

  return {
    plugin: plugin.meta.name,
    matched: result.matched,
    summary: result.summary,
    keySnippet: result.keySnippet,
    relatedFiles: result.relatedFiles ?? [],
    context: result.context,
    data: result.data,
    suggestions: result.suggestions ?? [],
  };
}

export async function runPlugins(
  input: CoreAnalysisInput,
  registry: PluginRegistry,
): Promise<PluginResult<unknown, unknown>[]> {
  const results: PluginResult<unknown, unknown>[] = [];

  for (const plugin of registry) {
    results.push(await runPlugin(plugin, input));
  }

  return results;
}
