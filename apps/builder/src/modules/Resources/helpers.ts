import { elementsByRoot } from '@plitzi/sdk-schema/helpers/elementTree';

import type { RootElements } from '@plitzi/sdk-schema/helpers/elementTree';
import type { ComponentDefinition, Schema } from '@plitzi/sdk-shared';

/** The plugin a plugin resource installed: the main one of the bundle its manifest roots. */
export const mainPluginOf = (
  plugins: Record<string, ComponentDefinition>,
  root: string
): ComponentDefinition | undefined => Object.values(plugins).find(plugin => plugin.type === root && plugin.isMain);

/** Where the space places a plugin's elements — its own and the ones it ships inside it — page by page. */
export const pluginUsage = (flat: Schema['flat'], plugin: ComponentDefinition): RootElements[] => {
  const types = new Set([plugin.type, ...((plugin.subPlugins as string[] | undefined) ?? [])]);

  return elementsByRoot(flat, element => types.has(element.definition.type));
};
