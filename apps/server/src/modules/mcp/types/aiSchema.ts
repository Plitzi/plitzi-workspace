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
  /** The ref of the folder this page lives in (a PageFolder id), or undefined for a root-level page. */
  folder?: string;
  elementCount: number;
}

/** A page folder in the sidebar tree. `ref` is the folder's id (there is no separate aiRef); pages reference it
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
  childCount: number;
  children?: AISkeletonNode[];
}

export interface AIPageSkeleton {
  ref: string;
  label: string;
  slug: string;
  default: boolean;
  /** Route params bound by the slug (e.g. ":spaceId" → ["spaceId"]). Valid as {{name}} references on this page,
   *  alongside the space-level plitzi://schema-variables. */
  routeParams: string[];
  tree: AISkeletonNode[];
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
  childRefs?: string[];
}

/** A global element style (a type 'element' StyleItem): its CSS applies to every element whose type equals
 *  `appliesToType`. It is not an addressable class definition — editing it would change every such element. */
export interface AIGlobalStyle extends AIDefinition {
  appliesToType: string;
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

export interface ValidationError {
  path: string;
  message: string;
  hint: string;
  validValues?: unknown[];
}
