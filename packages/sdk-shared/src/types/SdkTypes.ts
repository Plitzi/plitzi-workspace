import type { Collection } from './CollectionTypes';
import type { ComponentDefinition } from './ElementTypes';
import type { PluginRaw } from './PluginTypes';
import type { Schema } from './SchemaTypes';
import type { Segment } from './SegmentTypes';
import type { Style } from './StyleTypes';

export type OfflineDataRaw = {
  schema: Schema;
  style: Style;
  plugins?: PluginRaw[];
  segments?: Record<string, Segment>;
  collections?: Record<string, Collection>;
};

export type OfflineData = Omit<OfflineDataRaw, 'plugins'> & { plugins: Record<string, ComponentDefinition> };
