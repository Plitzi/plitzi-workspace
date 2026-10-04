import { z } from 'zod';

import { isSuggestionCode } from '@plitzi/sdk-authoring';
import { FLAG_GATE_PATTERN } from '@plitzi/sdk-shared/flags';
import { ANCHOR_PATTERN } from '@plitzi/sdk-shared/schema/anchor';
import { motionProblems } from '@plitzi/sdk-shared/schema/motion';

import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';
import type { ElementRuntime } from '@plitzi/sdk-shared';

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
  runtime?: ElementRuntime;
  flag?: string;
  anchor?: string;
  /** Checked by `motionProblems`: what arrives here is one, which `isMotion` narrows it to where it is written. */
  motion?: Record<string, unknown>;
  quiet?: string[];
  children?: ElementInput[];
}

export const styleRefs = z.object({
  base: z.array(z.string()).optional(),
  slots: z.record(z.string(), z.array(z.string())).optional()
});

// Which variant each attached class uses: class ref → selector (base or slot) → variant name(s). Applying a
// variant here is how an element opts into a variant declared on its definition (e.g. a button's "primary").
export const styleVariantInput = z.record(z.string(), z.record(z.string(), z.union([z.string(), z.array(z.string())])));

/** Where an element renders. It is the switch that decides whether an `apiContainer` fetches from the BROWSER
 *  (its `query` URL, with anything it authenticates with visible to the visitor) or from the SERVER through a
 *  connector — so a CMS integration is not wired until this says `server`. */
export const elementRuntime = z
  .enum(['server', 'client', 'shared'])
  .describe(
    'Where this element renders: "shared" (default, both), "client" (browser only), or "server" (SSR only). An ' +
      'apiContainer MUST be "server" to read through a connector — a client one calls its own `query` URL instead.'
  );

/** The feature flag an element exists under — `'name'` while on, `'!name'` while off. Not a visibility. */
export const elementFlag = z
  .string()
  .regex(FLAG_GATE_PATTERN)
  .describe('Feature flag: `name` renders only while on, `!name` only while off');

/** The element's `id` in the DOM, so `/page#anchor` lands on it — the one pattern every writer holds it to. */
export const elementAnchor = z
  .string()
  .regex(ANCHOR_PATTERN)
  .describe('Its DOM id, for `/page#anchor` and the `hash` of a link; one per page');

/**
 * How an element arrives and whether it keeps moving — the presets the SDK's stylesheet plays, and nothing else.
 *
 * An open object, checked by `motionProblems`, rather than its fields spelled out: this schema is in every tool that
 * carries the op union, and spelled out it cost the listing more than its budget had room for. A wrong preset is
 * refused with the list of right ones, and the guide's Motion section names them all.
 */
export const elementMotion = z
  .record(z.string(), z.unknown())
  .superRefine((motion, ctx) => {
    for (const problem of motionProblems(motion)) {
      ctx.addIssue({ code: 'custom', message: problem });
    }
  })
  .describe('{enter,on,duration,delay,stagger,loop} — guide: Motion');

/** Suggestions' codes an element is not offered, written that way on purpose; never a problem's code. */
export const elementQuiet = z
  .array(z.string())
  .superRefine((codes, ctx) => {
    for (const code of codes.filter(code => !isSuggestionCode(code))) {
      ctx.addIssue({ code: 'custom', message: `"${code}" is no suggestion's code` });
    }
  })
  .describe('Suggestion codes not offered on it, e.g. ["repeated-shape"]');

export const initialStateInput = z.object({
  styleVariant: styleVariantInput
    .optional()
    .describe('Variant each attached class uses: { className: { base|slot: variantName | [names] } }'),
  visibility: z.boolean().optional().describe('Initial visibility of the element')
});

// Every field of an element EXCEPT `children`, which each schema below closes over its own recursion. Shared so the
// repeat template (which adds a `repeat` node) cannot drift from the element it renders.
export const elementShape = {
  ref: z
    .string()
    .describe(
      'The name of the element. On a new one it BECOMES its id — the one key everything addresses it by: its data ' +
        'source is `<type>_<name>` and interactions target it by this. Letters, digits, `-` and `_`, starting ' +
        'with a letter; no dots (they would split that source path). Unique across the space.'
    ),
  // Required on purpose. Defaulting it to `container` saves a little repetition, but an agent that simply FORGOT
  // the type then gets a silent box instead of a parse error — and a widget render has no component catalog, so
  // the props it meant for a heading raise no warning either. A cheap batch is not worth a wrong widget nobody
  // is told about.
  type: z.string().describe('Type from plitzi://types'),
  label: z.string().optional(),
  subType: z.string().optional(),
  props: z.record(z.string(), z.unknown()).optional().describe('Full replacement on update'),
  style: styleRefs.optional().describe('Definition refs per slot; style the element by attaching a definition'),
  initialState: initialStateInput
    .optional()
    .describe('Applied style variant(s) and initial visibility (see plitzi://guide styling)'),
  runtime: elementRuntime.optional(),
  flag: elementFlag.optional(),
  anchor: elementAnchor.optional(),
  motion: elementMotion.optional(),
  quiet: elementQuiet.optional()
};

export const elementInput: z.ZodType<ElementInput> = z.lazy(() =>
  z.object({ ...elementShape, children: z.array(elementInput).optional() })
);

export const position = z
  .enum(['inside', 'before', 'after'])
  .describe('Placement relative to the anchor: "inside" nests it as a child (default), "before"/"after" as a sibling');

export type Position = z.infer<typeof position>;
export const scalar = z.union([z.string(), z.number(), z.boolean()]);

// --- Data bindings ---

export const bindingCategory = z
  .enum(['attributes', 'style', 'initialState'])
  .describe('What the value feeds: a prop (attributes), a style value (style), or an initialState key');

const bindingTransformer = z.object({
  action: z.string().describe('Transformer action name'),
  params: z.record(z.string(), z.string()),
  enabled: z
    .boolean()
    .optional()
    .describe('Set false to keep the transformer in the chain but skip it at runtime (defaults to true)')
});

export const bindingInput = z.object({
  to: z.string().describe('Target field the value feeds (a prop key, style value, or initialState key)'),
  source: z.string().describe('Data source path, e.g. "apiContainer_x.data" — see plitzi://data-sources'),
  id: z.string().optional().describe('Stable binding id; generated when omitted'),
  transformers: z.array(bindingTransformer).optional(),
  when: ruleGroup.optional().describe('QueryBuilder RuleGroup gating the binding (validated structurally)'),
  enabled: z.boolean().optional()
});

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
  whileRunning: z
    .enum(['skip', 'parallel', 'queue'])
    .optional()
    .describe('Trigger only: a refiring while this flow runs'),
  elementId: z
    .string()
    .optional()
    .describe('Element whose callback this step invokes, by name; defaults to this element'),
  preview: z.record(z.string(), z.unknown()).optional()
});

/** What the validator checks: an authored node, or one read back from storage — which may carry a `task` type the
 *  write vocabulary above does not offer. Checking the stored shape is the point; refusing it is the validator's. */
export type InteractionNodeInput = Omit<z.infer<typeof interactionNode>, 'nodeType'> & {
  nodeType: z.infer<typeof interactionNodeType> | 'task';
};
