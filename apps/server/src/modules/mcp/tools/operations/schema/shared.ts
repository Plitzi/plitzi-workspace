import { z } from 'zod';

import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';

// Shared zod fragments for the element-schema operations (one file per op imports what it needs from here).

// --- QueryBuilder RuleGroup (the `when` guard on bindings and interaction steps) ---
// Modeled FAITHFULLY to the QueryBuilder types so a malformed guard is rejected at input parse with a teachable
// error, instead of being stored and blowing up the runtime evaluator. Mirrors Combinator/Operator/Rule/RuleGroup.

const combinator = z.enum(['and', 'or']);

const operator = z.enum([
  '',
  '=',
  '!=',
  '<',
  '>',
  '<=',
  '>=',
  'contains',
  'doesNotContain',
  'beginsWith',
  'doesNotBeginWith',
  'endsWith',
  'doesNotEndWith',
  'empty',
  'notEmpty',
  'in',
  'notIn',
  'between',
  'notBetween'
]);

// RuleValue = Date | string | number | boolean | undefined | null | object. Over the wire (JSON) a Date never
// appears; `object` covers nested records/arrays. undefined is expressed by omitting the key.
const ruleValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.record(z.string(), z.unknown()),
  z.array(z.unknown())
]);

const ruleBase = {
  id: z.string().optional(),
  field: z.string().describe('The data field the rule tests'),
  operator,
  enabled: z.boolean().optional()
};

// A bound rule (`isBinding: true`) always carries a string value; a literal rule carries any RuleValue.
const rule = z.union([
  z.object({ ...ruleBase, isBinding: z.literal(true), value: z.string() }),
  z.object({ ...ruleBase, isBinding: z.literal(false).optional(), value: ruleValue })
]);

export const ruleGroup: z.ZodType<RuleGroup> = z.lazy(() =>
  z.object({
    id: z.string().optional(),
    combinator,
    rules: z.array(z.union([rule, ruleGroup])),
    enabled: z.boolean().optional()
  })
);

export interface InitialStateInput {
  styleVariant?: Record<string, Record<string, string | string[]>>;
  visibility?: boolean;
}

export interface ElementInput {
  ref: string;
  type: string;
  label?: string;
  subType?: string;
  props?: Record<string, unknown>;
  style?: { base?: string[]; slots?: Record<string, string[]> };
  initialState?: InitialStateInput;
  children?: ElementInput[];
}

export const styleRefs = z.object({
  base: z.array(z.string()).optional(),
  slots: z.record(z.string(), z.array(z.string())).optional()
});

// Which variant each attached class uses: class ref → selector (base or slot) → variant name(s). Applying a
// variant here is how an element opts into a variant declared on its definition (e.g. a button's "primary").
export const styleVariantInput = z.record(z.string(), z.record(z.string(), z.union([z.string(), z.array(z.string())])));

export const initialStateInput = z.object({
  styleVariant: styleVariantInput
    .optional()
    .describe('Variant each attached class uses: { className: { base|slot: variantName | [names] } }'),
  visibility: z.boolean().optional().describe('Initial visibility of the element')
});

export const elementInput: z.ZodType<ElementInput> = z.lazy(() =>
  z.object({
    ref: z.string().describe('Semantic id you choose, or an existing element ref/id'),
    type: z.string().describe('Type from plitzi://types'),
    label: z.string().optional(),
    subType: z.string().optional(),
    props: z.record(z.string(), z.unknown()).optional().describe('Full replacement on update'),
    style: styleRefs.optional().describe('Definition refs per slot; style the element by attaching a definition'),
    initialState: initialStateInput
      .optional()
      .describe('Applied style variant(s) and initial visibility (see plitzi://guide styling)'),
    children: z.array(elementInput).optional()
  })
);

export const position = z
  .enum(['inside', 'before', 'after'])
  .describe('Placement relative to the anchor: "inside" nests it as a child (default), "before"/"after" as a sibling');
export const scalar = z.union([z.string(), z.number(), z.boolean()]);

// --- Data bindings ---

export const bindingCategory = z
  .enum(['attributes', 'style', 'initialState'])
  .describe('What the value feeds: a prop (attributes), a style value (style), or an initialState key');

const bindingTransformer = z.object({
  action: z.string().describe('Transformer action name'),
  params: z.record(z.string(), z.string())
});

export const bindingInput = z.object({
  to: z.string().describe('Target field the value feeds (a prop key, style value, or initialState key)'),
  source: z.string().describe('Data source path, e.g. "apiContainer_x.data" — see plitzi://data-sources'),
  id: z.string().optional().describe('Stable binding id; generated when omitted'),
  transformers: z.array(bindingTransformer).optional(),
  when: ruleGroup.optional().describe('QueryBuilder RuleGroup gating the binding (validated structurally)'),
  enabled: z.boolean().optional()
});

export type BindingInput = z.infer<typeof bindingInput>;

// --- Interactions ---

export const interactionNodeType = z
  .enum(['trigger', 'globalCallback', 'callback', 'utility'])
  .describe('trigger starts a flow (must be first); the rest run in order after it');

export const interactionNode = z.object({
  id: z.string().optional().describe('Existing node id to preserve; generated when omitted'),
  title: z.string().describe('Human label for the step'),
  nodeType: interactionNodeType,
  action: z.string().describe('Action name, e.g. "onClick", "login" — see plitzi://interactions'),
  params: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
  when: ruleGroup.optional().describe('QueryBuilder RuleGroup gating this step (validated structurally)'),
  elementId: z.string().optional().describe('Source element the callback targets; defaults to this element'),
  preview: z.record(z.string(), z.unknown()).optional()
});

export type InteractionNodeInput = z.infer<typeof interactionNode>;
