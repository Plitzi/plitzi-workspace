import type { PluginManifest, PluginSchema } from './PluginTypes';

export type ComponentDefinition = Pick<PluginSchema, 'attributes' | 'builder' | 'definition' | 'defaultStyle'> & {
  assets: { type: 'style' | 'script'; url: string }[];
  manifest: PluginManifest;
  market: Omit<PluginManifest, 'name'> & { category: string };
  settings: { [key: string]: unknown };
};
