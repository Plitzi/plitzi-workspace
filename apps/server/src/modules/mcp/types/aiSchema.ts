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
  folder?: string;
  elementCount: number;
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
  childRefs?: string[];
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
