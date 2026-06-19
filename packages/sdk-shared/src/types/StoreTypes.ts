import type { Source } from './DataSourceTypes';
import type { Schema, Element } from './SchemaTypes';
import type { Segment } from './SegmentTypes';
import type { DisplayMode, Style, StyleState } from './StyleTypes';

// Real VALUES of the global data sources, published at runtime and read by element bindings. Grouped under
// `runtime.sources` so all source data lives together, separate from the document state (schema/style/segments)
// and from the top-level `sources` registry (which only holds authoring definitions). See RFC §4 A.2.
export type RuntimeSourceValues = {
  variables?: Record<string, unknown>;
  navigation?: { routeParams: Record<string, unknown>; queryParams: Record<string, unknown> };
  auth?: Record<string, unknown>;
  // The user/runtime application state, mirrored from `runtime.state` so element bindings can read it as `state.*`.
  state?: Record<string, unknown>;
  /** @deprecated Use the `state` source (mirrors `runtime.state`). Kept as an alias so existing `page.*` bindings keep
   * working; it still carries the runtime state plus `currentPageId`. */
  page?: Record<string, unknown>;
};

export type CommonState = {
  prevSchema?: Schema;
  schema: Schema;
  pageDefinitions: Record<string, Element>;
  style: Style;
  segments: Record<string, Segment>;
  // Runtime: real source DATA, all under `runtime.sources.*` — globals (typed) plus scoped per-instance sources
  // (dynamic keys), combined by the store's deep-merge scope chain. `runtime.state` holds the user/application state
  // (writable at runtime via interactions), separate from source values.
  runtime?: { sources: RuntimeSourceValues & Record<string, unknown>; state?: Record<string, unknown> };
  // Data-source REGISTRY (authoring metadata: which sources exist + their fields). Only definitions for
  // enumeration + the builder editor — NOT the real values (those are in `runtime.sources`).
  sources?: Record<string, Source>;
};

export type BuilderState = CommonState & {
  displayMode: DisplayMode;
  selector?: string;
  styleSelector?: string;
  styleVariant?: string;
  styleState?: StyleState;
  elementHovered?: string;
  elementSelected?: string;
  setHovered: (elementId?: string) => void;
  setSelected: (elementId?: string, iframeDOM?: HTMLIFrameElement | null, force?: boolean) => void;
};

export type SdkState = CommonState & {};
