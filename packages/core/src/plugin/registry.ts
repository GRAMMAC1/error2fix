import { genericPlugin } from '../plugins/generic.js';
import { javaPlugin } from '../plugins/java.js';
import { typescriptPlugin } from '../plugins/typescript.js';
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
  return createPluginRegistry([typescriptPlugin, javaPlugin, genericPlugin]);
}
