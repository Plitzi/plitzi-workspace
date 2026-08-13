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
};

export type OfflineData = Omit<OfflineDataRaw, 'plugins'> & { plugins: Record<string, ComponentDefinition> };

/**
 * Where the browser reports what it can only see from the browser — SPA route changes, interactions, the
 * visitor's country/device — and the credential it reports with.
 *
 * The page view that BILLS is never counted from here: a key that ships inside a public page is a key anyone
 * can replay, so quota is metered at the two server-side chokepoints that cost the deployment real bandwidth
 * (the SSR render, and the schema fetch a client-side render makes). This channel feeds the analytics plane
 * only. A render with no config reports nothing at all, which is what an offline export or an embedded widget
 * gets.
 */
export type AnalyticsConfig = {
  /** Collector base URL, e.g. `https://api.example.com/v1/collect`. Batches POST to `${endpoint}/batch`. */
  endpoint: string;
  /** Public per-space ingest key, sent as `x-plitzi-ingest-key`. */
  key: string;
  /** The server already counted this page load, so the first render must not be reported again. Set by SSR;
   *  a purely client-side render leaves it off and reports its own first view. */
  firstViewCounted?: boolean;
};
