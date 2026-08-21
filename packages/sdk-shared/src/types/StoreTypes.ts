import type { SubscriptionCollaborator, SubscriptionCollaboratorPointer } from './BuilderTypes';
import type { Environment, RenderMode } from './CommonTypes';
import type { Source } from './DataSourceTypes';
import type { QueryParams, RouteParams } from './NavigationTypes';
import type { Schema, Element } from './SchemaTypes';
import type { Segment } from './SegmentTypes';
import type { SpaceConnector } from './SpaceTypes';
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
  // Server-driven data (RSC), seeded at the SDK root from what the rendering server published. Top-level on purpose:
  // an element scope that owns `runtime` would keep a delegated `runtime.rsc.*` write to itself, and nothing but the
  // root ever owns `rsc`, so every write from any depth lands where the whole tree reads it.
  rsc?: RscState;
  // Where this origin runs server actions, seeded at the root from what the rendering server published. Top-level
  // beside `rsc` and for the same reason: nothing but the root owns it, and every depth reads it.
  actions?: ActionsState;
  // How THIS render is happening. Seeded once at the root of whichever surface is mounting (the SDK, the builder) and
  // read from the store by everything below, instead of being threaded through every provider as five props.
  render?: RenderSettings;

  // Navigation state, mirrored from the navigation provider so element bindings can read it as `navigation.*`. It is
  // ephemeral — excluded from persist and history — and exists so navigation state is uniformly observable in devtools.
  navigation: {
    urlSearchParams?: URLSearchParams;
    routeParams: RouteParams;
    queryParams: QueryParams;
    hostname: string;
    currentPageId: string;
    navigate: (url: string, isExternal?: boolean) => void;
  };
};

/** Not document state and not server data: the surface the schema is being rendered on. `previewMode` and
 *  `debugMode` change at runtime (the builder's preview toggle, shift+F12), so reads of these are reactive; the rest
 *  are fixed for the life of the render. */
export type RenderSettings = {
  previewMode?: boolean;
  debugMode?: boolean;
  renderMode?: RenderMode;
  environment?: Environment;
  isHydrating?: boolean;
};

// `enabled` is the single answer to "is RSC live in this render": the schema asking for it is not enough, a server
// has to answer it (`endpoint`), which a client-only render has none of. `loaded` separates "no payload ever arrived"
// (the builder, an embed → providers fall back to mock data) from "it arrived and this element is not in it" (a
// provider that failed server-side → an error, never dressed up as content). `data` is keyed by element id.
/** Absent `endpoint` is the whole feature switch: a render with no server tier leaves every `serverAction` step
 *  inert instead of letting each click discover a 404. */
export type ActionsState = {
  endpoint?: string;
};

export type RscState = {
  enabled?: boolean;
  endpoint?: string;
  loaded?: boolean;
  data?: Record<string, unknown>;
  /**
   * True when the last refresh could not reach the server, so what every server element is showing is from before
   * that.
   *
   * A refresh failing is not an error — the payload is supplemental, and dropping it keeps the page working — but
   * silently keeping the old data is a page that looks current and is not. Published so an author can bind it and
   * say so; cleared by the first refresh that gets through.
   */
  stale?: boolean;
};

export type BuilderState = CommonState & {
  // Presence: who else is editing this space right now, and what they are pointing at. Not document state — it is
  // excluded from history and never persisted — but it lives in the store so it is observable in the devtools like
  // everything else, and so any surface can read it without threading it through the network provider.
  // `pointers` is debug-only (see SubscriptionCollaboratorPointer): keyed by instanceId, written at a low rate
  // while debug mode is on and absent otherwise.
  collaboration: {
    collaborators: SubscriptionCollaborator[];
    pointers?: Record<string, SubscriptionCollaboratorPointer>;
  };
  // Connector manifests available to this space, keyed by identifier. Editor-only: the builder needs endpoints and
  // operator names to offer a connector picker and typed filters, and this store is never serialized into the
  // published schema — which is what keeps the topology off the visitor's page (RFC 0008 §4.2).
  connectors: Record<string, SpaceConnector>;
  // Whether the space deploys anywhere that can run server code. Connectors resolve before the page reaches the
  // browser, so on a client-rendered deployment they resolve nowhere — the element settings say so rather than
  // offering a picker that cannot work in production.
  hasServerRendering: boolean;
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
// ancestors like the page are always large). `baseDuration` is React's estimate of rendering the whole subtree
// without memoization. `parentId` is the nearest ancestor element in the REAL render tree (captured via
// ElementContext), so the viewer nests correctly even across schemas/rootIds (e.g. a layout rendered inside a page) —
// undefined only for the topmost element (the page root). Whether the element rendered ITSELF (vs only a descendant
// did) is derived in the viewer from self time: React propagates `actualDuration` additively, so a node that did no
// own work has self time of exactly 0 — "rendered" vs "bubbled" without any render-time instrumentation.
// One changed input of an element between two of its renders: the prop/data key and compact previews of its value
// before and after. `prev`/`next` referentially equal but shown identical is the classic unnecessary-re-render tell
// (a new object/array reference with the same content).
export type PropChange = {
  key: string;
  prev: string;
  next: string;
  // The reference changed but the shallow content is equal — a new object/array with the same values, i.e. the classic
  // missing-memo cause of an unnecessary re-render.
  ref?: boolean;
};

export type CommitElementRender = {
  id: string;
  parentId?: string;
  phase: RenderPhase;
  actualDuration: number;
  baseDuration: number;
  // Shallow diff of the element's inputs (props + element data) against its previous render, captured in `withElement`
  // under `debugMode`. An EMPTY array on an `update` means nothing the element reads changed — it re-rendered only
  // because an ancestor/context did, the prime suspect for an unnecessary re-render. Undefined on the SSR marker.
  changedProps?: PropChange[];
};

// A single store write that preceded a commit: the path that changed plus a compact `prev → next` preview of the value
// at that path, so the data-level cause is legible without expanding the store.
export type CommitCause = {
  path: string;
  preview?: string;
};

// A group of element renders React flushed together (same `commitTime`). `causes` are the store writes captured just
// before this commit (from nexus `subscribeChange`) — the "why did it render" at the data level.
export type CommitEntry = {
  commitId: number;
  timestamp: number;
  duration: number;
  elementCount: number;
  elements: CommitElementRender[];
  causes: CommitCause[];
};

// Accumulated render-tree info for one element, gathered across ALL commits (not just the latest). `parentId` is its
// real render-tree parent; `baseDuration` is the last value React reported (its no-memoization subtree estimate).
export type TracingTreeNode = {
  parentId?: string;
  baseDuration: number;
};

// The whole known render tree, keyed by element id. Because it accumulates across commits, the viewer can rebuild the
// FULL tree for any single commit — including elements that did NOT render in it — so rendered nodes nest under their
// real (possibly non-rendered) ancestors and self time isn't misattributed, and untouched branches show as hatched.
export type TracingTree = Record<string, TracingTreeNode>;

export type TracingState = {
  // True once any profiled element has committed — i.e. `debugMode` is on in the element tree, so instrumentation is
  // live. The devtools panel renders outside the service provider and can't read `debugMode` directly, so it relies
  // on this flag to know tracing is available.
  enabled: boolean;
  // True when this app was rendered from SSR output and hydrated on the client (the `hydrateRoot` path), as opposed
  // to a pure client `createRoot`. Lets the viewer tell a real hydration commit from an ordinary client initial mount
  // — both have React phase `mount`, so phase alone can't distinguish them.
  hydrated: boolean;
  commits: CommitEntry[];
  tree: TracingTree;
};
