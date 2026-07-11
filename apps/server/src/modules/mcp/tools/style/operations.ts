import { z } from 'zod';

// Operations on the STYLE schema (Style model): definitions (reusable classes) and design tokens.

const cssMap = z
  .record(z.string(), z.union([z.string(), z.number()]))
  .describe('kebab-case CSS props; use var(--name) for tokens and {{name}} for schema vars');

const displayModeCss = z.object({
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

const displayModeCssPatch = z.object({
  desktop: cssPatchMap.optional(),
  tablet: cssPatchMap.optional(),
  mobile: cssPatchMap.optional()
});

const definitionSlotPatch = displayModeCssPatch.extend({
  states: z.record(z.string(), displayModeCssPatch).optional(),
  variants: z.record(z.string(), displayModeCssPatch).optional()
});

export type DefinitionSlotPatch = z.infer<typeof definitionSlotPatch>;

const styleCategory = z.enum(['color', 'spacing', 'shadow', 'custom']);
const themeValue = z.union([
  z.string(),
  z.number(),
  z.object({ light: z.string().optional(), dark: z.string().optional(), default: z.string().optional() })
]);

export const styleOps = {
  upsertDefinition: z.object({
    type: z.literal('upsertDefinition'),
    ref: z.string(),
    desktop: cssMap.optional(),
    tablet: cssMap.optional(),
    mobile: cssMap.optional(),
    states: z.record(z.string(), displayModeCss).optional(),
    variants: z.record(z.string(), displayModeCss).optional(),
    slots: z.record(z.string(), definitionSlot).optional()
  }),
  patchDefinition: z.object({
    type: z.literal('patchDefinition'),
    ref: z.string(),
    desktop: cssPatchMap.optional(),
    tablet: cssPatchMap.optional(),
    mobile: cssPatchMap.optional(),
    states: z.record(z.string(), displayModeCssPatch).optional(),
    variants: z.record(z.string(), displayModeCssPatch).optional(),
    slots: z.record(z.string(), definitionSlotPatch).optional()
  }),
  deleteDefinition: z.object({ type: z.literal('deleteDefinition'), ref: z.string() }),
  // Global element selectors — the CSS equivalent of `button { … }`: they style EVERY element of a type. Keyed by
  // componentType (its name IS the type). Use these ONLY for deliberate site-wide intent ("all buttons rounded");
  // to style one element, attach a class definition instead.
  upsertGlobalStyle: z.object({
    type: z.literal('upsertGlobalStyle'),
    componentType: z.string().describe('Element type to style site-wide (e.g. "button"); affects ALL of that type'),
    desktop: cssMap.optional(),
    tablet: cssMap.optional(),
    mobile: cssMap.optional(),
    states: z.record(z.string(), displayModeCss).optional(),
    variants: z.record(z.string(), displayModeCss).optional(),
    slots: z.record(z.string(), definitionSlot).optional()
  }),
  patchGlobalStyle: z.object({
    type: z.literal('patchGlobalStyle'),
    componentType: z.string().describe('Element type whose global style to merge into; affects ALL of that type'),
    desktop: cssPatchMap.optional(),
    tablet: cssPatchMap.optional(),
    mobile: cssPatchMap.optional(),
    states: z.record(z.string(), displayModeCssPatch).optional(),
    variants: z.record(z.string(), displayModeCssPatch).optional(),
    slots: z.record(z.string(), definitionSlotPatch).optional()
  }),
  deleteGlobalStyle: z.object({ type: z.literal('deleteGlobalStyle'), componentType: z.string() }),
  upsertStyleVariable: z.object({
    type: z.literal('upsertStyleVariable'),
    category: styleCategory,
    name: z.string(),
    value: themeValue
  }),
  deleteStyleVariable: z.object({ type: z.literal('deleteStyleVariable'), category: styleCategory, name: z.string() })
};
