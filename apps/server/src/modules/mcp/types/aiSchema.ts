import type { Environment } from '@plitzi/sdk-shared';

export type Env = Environment;

/** CSS declarations for one selector state. Keys are kebab-case CSS properties (see plitzi://css-properties). */
export type CssProps = Record<string, string | number>;

export interface DisplayModeCss {
  desktop?: CssProps;
  tablet?: CssProps;
  mobile?: CssProps;
}

export interface ResourceEnvelope<T> {
  stateVersion: string;
  data: T;
}

/**
 * Read projections follow a filesystem model: list cheap summaries/skeletons, then read one element's detail
 * on demand. Heavy per-element data (props, style) lives only in AIElementDetail, never in the listings.
 */

export interface AIPageSummary {
  ref: string;
  label: string;
  slug: string;
  default: boolean;
  /** Whether the page is served by the published SDK runtime. A disabled page (`false`) is not routable/accessible
   *  to end users, but stays fully editable here. Defaults to true. */
  enabled: boolean;
  /** The ref of the folder this page lives in (a PageFolder id), or undefined for a root-level page. */
  folder?: string;
  elementCount: number;
}

/** A page folder in the sidebar tree. `ref` is the folder's id (there is no separate idRef); pages reference it
 *  by that id via their `folder`, and nested folders via `parentId`. */
export interface AIFolder {
  ref: string;
  name: string;
  slug: string;
  parentId?: string;
}

export interface AISkeletonNode {
  ref: string;
  type: string;
  label: string;
  subType?: string;
  /** The class refs this node attaches on its base selector — names only, no CSS. Lets an agent map element →
   *  class straight from the page skeleton, without a per-element read just to learn which class it uses. */
  base?: string[];
  /** Class refs attached on non-base slots (slot → class refs), names only. */
  slots?: Record<string, string[]>;
  childCount: number;
  children?: AISkeletonNode[];
}

export interface AIPageSkeleton {
  ref: string;
  label: string;
  slug: string;
  default: boolean;
  /** Whether the page is served by the published SDK runtime. A disabled page (`false`) is not routable/accessible
   *  to end users, but stays fully editable here. Defaults to true. */
  enabled: boolean;
  /** Route params bound by the slug (e.g. ":spaceId" → ["spaceId"]). Valid as {{name}} references on this page,
   *  alongside the space-level plitzi://schema-variables. */
  routeParams: string[];
  tree: AISkeletonNode[];
}

/** Every style a page uses in one payload: the class definitions its elements attach (deduplicated, with CSS)
 *  and the global element selectors that affect any element type present on the page. Collapses "what styles
 *  does this page use" to a single read, with no reliance on a shared class-naming prefix. */
export interface AIPageStyles {
  ref: string;
  definitions: AIDefinition[];
  globalStyles: AIGlobalStyle[];
}

/** Which variant each attached class/selector currently uses on this element (element.definition.initialState
 *  .styleVariant). Outer key = class ref, inner key = selector (`base` or a slot), value = variant name(s). */
export type AIStyleVariantSelection = Record<string, Record<string, string | string[]>>;

/** The element's initial (default) state overrides. `styleVariant` picks which variant of its classes is active;
 *  `visibility` hides/shows it initially. Kept minimal — the two fields agents actually set. */
export interface AIInitialState {
  styleVariant?: AIStyleVariantSelection;
  visibility?: boolean;
}

/** One data binding: connect a data `source` to the element field named by `to` (a prop, a style value, or an
 *  initial-state key, per its category). `transformers` reshape the value; `when` gates the binding. */
export interface AIBinding {
  id: string;
  to: string;
  source: string;
  transformers?: Array<{ action: string; params: Record<string, string> }>;
  when?: unknown;
  enabled?: boolean;
}

/** Data bindings on an element, grouped by what they feed: element props (`attributes`), style values (`style`),
 *  or initial-state keys (`initialState`). */
export type AIBindings = Partial<Record<'attributes' | 'style' | 'initialState', AIBinding[]>>;

export type AIInteractionNodeType = 'trigger' | 'globalCallback' | 'callback' | 'utility';

/** One step of an interaction flow, projected from the stored doubly-linked node. Order is conveyed by the
 *  position in `AIInteractionFlow.nodes`; the stored beforeNode/afterNode/flowId links are computed on write. */
export interface AIInteractionNode {
  id: string;
  title: string;
  nodeType: AIInteractionNodeType;
  action: string;
  params?: Record<string, unknown>;
  enabled?: boolean;
  when?: unknown;
  /** Source element the callback targets (globalCallback/utility). Defaults to this element on write. */
  elementId?: string;
  preview?: Record<string, unknown>;
}

/** One interaction flow on an element: a trigger (first node) followed by the callbacks/utilities it runs, in
 *  order. `flowId` equals the trigger node id. */
export interface AIInteractionFlow {
  flowId: string;
  nodes: AIInteractionNode[];
}

export interface AIElementDetail {
  ref: string;
  type: string;
  subType?: string;
  label: string;
  pageRef: string;
  parentRef?: string;
  props?: Record<string, unknown>;
  style: { base: string[]; slots: Record<string, string[]> };
  /** CSS of the definitions referenced by `style` (keyed by class ref), inlined so an edit needs no follow-up
   *  read of each definition. Present only for refs that resolve to a definition. */
  resolvedStyle?: Record<string, AIDefinition>;
  /** Global (type 'element') styles that also affect this element because they target its type — every element of
   *  the type inherits them. Read-only here (not editable as definitions); shown so the effective CSS is complete. */
  globalStyles?: AIGlobalStyle[];
  /** Id rule (type 'id') targeting this element by its DOM `id` attribute (`#id`). Present only when the element
   *  carries an `id` that a rule matches. Edit it with the id-style tools (never as a definition). */
  idStyle?: AIIdStyle;
  /** Variant names each attached class exposes (deduped across its selectors), so the agent knows a class HAS a
   *  variant (e.g. a button class with "primary") before applying it via `initialState.styleVariant`. */
  availableVariants?: Record<string, string[]>;
  /** Which variant/visibility this element applies today (element.definition.initialState). */
  initialState?: AIInitialState;
  /** Data bindings on this element, grouped by category. */
  bindings?: AIBindings;
  /** Interaction flows on this element (event → ordered callbacks). */
  interactions?: AIInteractionFlow[];
  childRefs?: string[];
}

/** A global element style (a type 'element' StyleItem): its CSS applies to every element whose type equals
 *  `appliesToType`. It is not an addressable class definition — editing it would change every such element. */
export interface AIGlobalStyle extends AIDefinition {
  appliesToType: string;
}

/** An id rule (a type 'id' StyleItem): its CSS targets the single element whose DOM `id` equals `targetId`
 *  (the CSS equivalent of `#id { … }`). Style one element by giving it an `id` attribute and writing this rule;
 *  prefer a class definition when the styling could be reused. */
export interface AIIdStyle extends AIDefinition {
  targetId: string;
}

export interface AIDefinitionSlot extends DisplayModeCss {
  states?: Record<string, DisplayModeCss>;
  variants?: Record<string, DisplayModeCss>;
}

export interface AIDefinition extends AIDefinitionSlot {
  ref: string;
  slots?: Record<string, AIDefinitionSlot>;
}

export type StyleVariableCategory = 'color' | 'spacing' | 'shadow' | 'custom';

export type StyleVariableValue = string | number | { light?: string; dark?: string; default?: string };

export interface AIStyleVariable {
  name: string;
  reference: string;
  value: StyleVariableValue;
}

export interface AISchemaVariable {
  name: string;
  reference: string;
  category: string;
  type: string;
  value: string | number | boolean;
  subValues?: Array<{ when: unknown; value: string | number | boolean }>;
}

/** Space-level settings: the arbitrary global CSS (`customCss`), state persistence, and the user/auth provider
 *  configuration. Every field is optional — a patch changes only the keys it sends. */
export interface AISettings {
  customCss?: string;
  keepState?: boolean;
  stateStorage?: 'localStorage' | 'sessionStorage';
  userProvider?: 'auth0' | 'basic' | 'custom' | '';
  auth0Domain?: string;
  auth0ClientId?: string;
  tokenStorage?: 'localStorage' | 'sessionStorage' | '';
  loginUrl?: string;
  userUrl?: string;
  refreshUrl?: string;
  logoutUrl?: string;
  detailsPath?: string;
  tokenPath?: string;
  expirationTimePath?: string;
}

export interface ValidationError {
  path: string;
  message: string;
  hint: string;
  validValues?: unknown[];
}
