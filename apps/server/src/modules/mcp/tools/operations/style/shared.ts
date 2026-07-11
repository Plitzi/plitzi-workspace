import { z } from 'zod';

// Shared zod fragments for the style-schema operations (definitions, global element selectors, design tokens).

const cssMap = z
  .record(z.string(), z.union([z.string(), z.number()]))
  .describe('kebab-case CSS props; use var(--name) for tokens and {{name}} for schema vars');

export const displayModeCss = z.object({
  desktop: cssMap.optional(),
  tablet: cssMap.optional(),
  mobile: cssMap.optional()
});

const definitionSlot = displayModeCss.extend({
  states: z.record(z.string(), displayModeCss).optional(),
  variants: z.record(z.string(), displayModeCss).optional()
});

export type DefinitionSlotInput = z.infer<typeof definitionSlot>;

// Patch variants of the same shapes: a CSS value of `null` removes that property, so a partial patch can both set
// and unset individual keys while leaving every other declaration untouched (mirrors patchElement).
const cssPatchMap = z
  .record(z.string(), z.union([z.string(), z.number(), z.null()]))
  .describe('kebab-case CSS props; a value of null removes the property, others are merged onto the existing CSS');

export const displayModeCssPatch = z.object({
  desktop: cssPatchMap.optional(),
  tablet: cssPatchMap.optional(),
  mobile: cssPatchMap.optional()
});

const definitionSlotPatch = displayModeCssPatch.extend({
  states: z.record(z.string(), displayModeCssPatch).optional(),
  variants: z.record(z.string(), displayModeCssPatch).optional()
});

export type DefinitionSlotPatch = z.infer<typeof definitionSlotPatch>;

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
  variants: z.record(z.string(), displayModeCss).optional(),
  slots: z.record(z.string(), definitionSlot).optional()
};

export const patchCssShape = {
  desktop: cssPatchMap.optional(),
  tablet: cssPatchMap.optional(),
  mobile: cssPatchMap.optional(),
  states: z.record(z.string(), displayModeCssPatch).optional(),
  variants: z.record(z.string(), displayModeCssPatch).optional(),
  slots: z.record(z.string(), definitionSlotPatch).optional()
};
