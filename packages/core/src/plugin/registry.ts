import { dependencyResolutionPlugin } from '../plugins/dependency-resolution.js';
import { frontendCompilerPlugin } from '../plugins/frontend-compiler.js';
import { frontendRuntimePlugin } from '../plugins/frontend-runtime.js';
import { genericPlugin } from '../plugins/generic.js';
import type { Error2FixPlugin, PluginRegistry } from '../types/plugin.js';

export function createPluginRegistry(
  plugins: Error2FixPlugin<unknown, unknown>[] = [],
): PluginRegistry {
  return [...plugins];
}

export function registerPlugin(
  registry: PluginRegistry,
  plugin: Error2FixPlugin<unknown, unknown>,
): PluginRegistry {
  return [...registry, plugin];
}

export function getDefaultPluginRegistry(): PluginRegistry {
  return createPluginRegistry([
    frontendCompilerPlugin,
    frontendRuntimePlugin,
    dependencyResolutionPlugin,
    genericPlugin,
  ]);
}
