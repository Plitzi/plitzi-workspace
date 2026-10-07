import { z } from 'zod';

// Shared zod fragments for the style-schema operations (definitions, global element selectors, design tokens).

export const cssMap = z
  .record(z.string(), z.union([z.string(), z.number()]))
  .describe(
    'Plain kebab-case CSS. Shorthands are welcome — `border: 1px solid red`, `padding: 8px 16px`, ' +
      '`font: bold 16px/1.5 Arial`, `transition: opacity 200ms ease` — and are stored as their longhands so a ' +
      'breakpoint/state/variant can override each property on its own. Use var(--name) for style tokens and ' +
      '{{name}} for schema vars.'
  );

export const displayModeCss = z.object({
  desktop: cssMap.optional(),
  tablet: cssMap.optional(),
  mobile: cssMap.optional()
});

const ANCESTORS_DESCRIPTION =
  'By the class an ancestor wears: rules inside it — `.card .icon` is `{ card: { desktop: {…} } }` — or while it ' +
  'is in a state or variant — `.card:hover .icon` is `{ card: { states: { hover: {…} } } }`. `">"` is the parent, ' +
  'whatever it wears: the part of a closed component reacting to the element around it — ' +
  '`{ ">": { states: { expanded: {…} } } }`.';

const PSEUDOS_DESCRIPTION =
  'By name, no colons: before, after, marker, placeholder, first-letter, first-line, selection; each per breakpoint ' +
  'and in states. content is CSS text with its quotes ("\\"→\\""); before/after are drawn only with one.';

const CONDITIONS_DESCRIPTION =
  'motion-reduce, motion-safe, or a container width: "container (max-width: 30rem)", "container card ' +
  '(min-width: 480px)" (the nearest ancestor whose class sets container-type).';

export const ancestorCondition = displayModeCss.extend({
  states: z.record(z.string(), displayModeCss).optional(),
  variants: z.record(z.string(), displayModeCss).optional()
});

export const ancestors = z.record(z.string(), ancestorCondition).describe(ANCESTORS_DESCRIPTION);

export const pseudoPart = displayModeCss.extend({ states: z.record(z.string(), displayModeCss).optional() });

export const pseudos = z.record(z.string(), pseudoPart).describe(PSEUDOS_DESCRIPTION);

export const variantPart = pseudoPart.extend({ pseudos: pseudos.optional() });

export const conditions = z.record(z.string(), variantPart).describe(CONDITIONS_DESCRIPTION);

export const definitionSlot = displayModeCss.extend({
  states: z.record(z.string(), displayModeCss).optional(),
  variants: z.record(z.string(), variantPart).optional(),
  ancestors: ancestors.optional(),
  pseudos: pseudos.optional(),
  conditions: conditions.optional()
});

export type DefinitionSlotInput = z.infer<typeof definitionSlot>;
export type PseudoPartInput = z.infer<typeof pseudoPart>;
export type VariantPartInput = z.infer<typeof variantPart>;

// Patch variants of the same shapes: a CSS value of `null` removes that property, so a partial patch can both set
// and unset individual keys while leaving every other declaration untouched (mirrors patchElement).
export const cssPatchMap = z
  .record(z.string(), z.union([z.string(), z.number(), z.null()]))
  .describe(
    'Plain kebab-case CSS merged onto the existing declarations; shorthands are accepted and expanded, so ' +
      '`padding: 8px` replaces all four sides. A value of null removes the property — null on a shorthand ' +
      '(`border: null`) removes every longhand it controls.'
  );

export const displayModeCssPatch = z.object({
  desktop: cssPatchMap.optional(),
  tablet: cssPatchMap.optional(),
  mobile: cssPatchMap.optional()
});

export const ancestorConditionPatch = displayModeCssPatch.extend({
  states: z.record(z.string(), displayModeCssPatch).optional(),
  variants: z.record(z.string(), displayModeCssPatch).optional()
});

export const ancestorsPatch = z
  .record(z.string(), ancestorConditionPatch.nullable())
  .describe(`${ANCESTORS_DESCRIPTION} null removes an ancestor.`);

export const pseudoPartPatch = displayModeCssPatch.extend({
  states: z.record(z.string(), displayModeCssPatch).optional()
});

export const pseudosPatch = z
  .record(z.string(), pseudoPartPatch.nullable())
  .describe('As StylePseudos; null removes one.');

export const variantPartPatch = pseudoPartPatch.extend({ pseudos: pseudosPatch.optional() });

export const conditionsPatch = z
  .record(z.string(), variantPartPatch.nullable())
  .describe('As StyleConditions; null removes one.');

export const definitionSlotPatch = displayModeCssPatch.extend({
  states: z.record(z.string(), displayModeCssPatch).optional(),
  variants: z.record(z.string(), variantPartPatch).optional(),
  ancestors: ancestorsPatch.optional(),
  pseudos: pseudosPatch.optional(),
  conditions: conditionsPatch.optional()
});

export type DefinitionSlotPatch = z.infer<typeof definitionSlotPatch>;
export type PseudoPartPatch = z.infer<typeof pseudoPartPatch>;
export type VariantPartPatch = z.infer<typeof variantPartPatch>;

export const styleCategory = z.enum(['color', 'spacing', 'shadow', 'custom']);
export const themeValue = z.union([
  z.string(),
  z.number(),
  z.object({ light: z.string().optional(), dark: z.string().optional(), default: z.string().optional() })
]);

// The CSS-carrying fields every definition / global-style op shares, in upsert (full) and patch (nullable) forms.
export const upsertCssShape = {
  desktop: cssMap.optional(),
  tablet: cssMap.optional(),
  mobile: cssMap.optional(),
  states: z.record(z.string(), displayModeCss).optional(),
  variants: z.record(z.string(), variantPart).optional(),
  ancestors: ancestors.optional(),
  pseudos: pseudos.optional(),
  conditions: conditions.optional(),
  slots: z.record(z.string(), definitionSlot).optional()
};

export const patchCssShape = {
  desktop: cssPatchMap.optional(),
  tablet: cssPatchMap.optional(),
  mobile: cssPatchMap.optional(),
  states: z.record(z.string(), displayModeCssPatch).optional(),
  variants: z.record(z.string(), variantPartPatch).optional(),
  ancestors: ancestorsPatch.optional(),
  pseudos: pseudosPatch.optional(),
  conditions: conditionsPatch.optional(),
  slots: z.record(z.string(), definitionSlotPatch).optional()
};
