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

export const definitionSlot = displayModeCss.extend({
  states: z.record(z.string(), displayModeCss).optional(),
  variants: z.record(z.string(), displayModeCss).optional()
});

export type DefinitionSlotInput = z.infer<typeof definitionSlot>;

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

export const definitionSlotPatch = displayModeCssPatch.extend({
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
