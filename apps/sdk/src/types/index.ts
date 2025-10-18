import type { Collection, ComponentDefinition, PluginRaw, Schema, Segment, Style } from '@plitzi/sdk-shared';

export type OfflineDataRaw = {
  schema: Schema;
  style: Style;
  plugins?: PluginRaw[];
  segments?: Record<string, Segment>;
  collections?: Record<string, Collection>;
};

export type OfflineData = Omit<OfflineDataRaw, 'plugins'> & { plugins: Record<string, ComponentDefinition> };

export type RenderMode = 'raw' | 'iframe' | 'shadow' | 'ssr' | 'widget';
