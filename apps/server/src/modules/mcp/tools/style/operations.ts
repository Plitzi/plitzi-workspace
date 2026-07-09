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
  deleteDefinition: z.object({ type: z.literal('deleteDefinition'), ref: z.string() }),
  upsertStyleVariable: z.object({
    type: z.literal('upsertStyleVariable'),
    category: styleCategory,
    name: z.string(),
    value: themeValue
  }),
  deleteStyleVariable: z.object({ type: z.literal('deleteStyleVariable'), category: styleCategory, name: z.string() })
};
