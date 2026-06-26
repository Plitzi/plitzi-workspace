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
  // (writable at runtime via interactions), separate from source values. `runtime.elements` holds each element's
  // private UI state, keyed by element id (and a `scopePath` sub-key for duplicated instances like list rows); it is
  // ephemeral — excluded from persist and history — and exists so element state is uniformly observable in devtools.
  runtime?: {
    sources: RuntimeSourceValues & Record<string, unknown>;
    // Global State
    state?: Record<string, unknown>;
    // Element State
    elements?: Record<string, unknown>;
  };
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

// Render tracing (devtools Tracing tab). Fed by a React `<Profiler>` per element (see the tracing store/collector
// under `store/tracing`) and read by the devtools panel. The collector stores only React's raw, subtree-INCLUSIVE
// `actualDuration` per commit; SELF time (own work) is derived in the viewer from the schema tree, where `flat` is
// always available — so it never depends on capture-time instrumentation order.
export type RenderPhase = 'mount' | 'update' | 'nested-update';

// One profiled element render within a commit. `actualDuration` is React's subtree-INCLUSIVE time (cascades up, so
// ancestors like the page are always large). `parentId` is the nearest ancestor element in the REAL render tree
// (captured via ElementContext), so the viewer nests correctly even across schemas/rootIds (e.g. a layout rendered
// inside a page) — undefined only for the topmost element (the page root).
export type CommitElementRender = {
  id: string;
  parentId?: string;
  phase: RenderPhase;
  actualDuration: number;
};

// A group of element renders React flushed together (same `commitTime`).
export type CommitEntry = {
  commitId: number;
  timestamp: number;
  duration: number;
  elementCount: number;
  elements: CommitElementRender[];
};

export type TracingState = {
  // True once any profiled element has committed — i.e. `debugMode` is on in the element tree, so instrumentation is
  // live. The devtools panel renders outside the service provider and can't read `debugMode` directly, so it relies
  // on this flag to know tracing is available.
  enabled: boolean;
  commits: CommitEntry[];
};
