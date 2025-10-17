import type { Collection, PluginRaw, Schema, Segment, Style } from '@plitzi/sdk-shared';

export type OfflineData = {
  schema: Schema;
  style: Style;
  plugins?: PluginRaw[];
  segments?: Record<string, Segment>;
  collections?: Record<string, Collection>;
};
