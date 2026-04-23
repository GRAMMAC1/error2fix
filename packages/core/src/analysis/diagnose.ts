import { getDefaultPluginRegistry } from '../plugin/registry.js';
import { runPlugins } from '../plugin/run.js';
import type { CoreAnalysis } from '../types/core.js';
import type { LatestRawCapture } from '../types/metadata.js';
import type { PluginRegistry } from '../types/plugin.js';
import { aggregateCoreAnalysis } from './aggregate.js';
import { buildCoreAnalysisInput } from './build-input.js';

export async function diagnoseCapture(
  capture: LatestRawCapture,
  registry: PluginRegistry = getDefaultPluginRegistry(),
): Promise<CoreAnalysis> {
  const input = await buildCoreAnalysisInput(capture);
  const pluginResults = await runPlugins(input, registry);
  return aggregateCoreAnalysis(input, pluginResults);
}
