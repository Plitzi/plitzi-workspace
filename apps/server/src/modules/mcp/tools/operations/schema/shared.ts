import { z } from 'zod';

// Shared zod fragments for the element-schema operations (one file per op imports what it needs from here).

export interface ElementInput {
  ref: string;
  type: string;
  label?: string;
  subType?: string;
  props?: Record<string, unknown>;
  style?: { base?: string[]; slots?: Record<string, string[]> };
  children?: ElementInput[];
}

export const styleRefs = z.object({
  base: z.array(z.string()).optional(),
  slots: z.record(z.string(), z.array(z.string())).optional()
});

export const elementInput: z.ZodType<ElementInput> = z.lazy(() =>
  z.object({
    ref: z.string().describe('Semantic id you choose, or an existing element ref/id'),
    type: z.string().describe('Type from plitzi://types'),
    label: z.string().optional(),
    subType: z.string().optional(),
    props: z.record(z.string(), z.unknown()).optional().describe('Full replacement on update'),
    style: styleRefs.optional().describe('Definition refs per slot; style the element by attaching a definition'),
    children: z.array(elementInput).optional()
  })
);

export const position = z.enum(['inside', 'before', 'after']);
export const scalar = z.union([z.string(), z.number(), z.boolean()]);
