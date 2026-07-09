import { z } from 'zod';

// Operations on the ELEMENT schema (Space model): pages, elements and schema variables.

export interface ElementInput {
  ref: string;
  type: string;
  label?: string;
  subType?: string;
  props?: Record<string, unknown>;
  style?: { base?: string[]; slots?: Record<string, string[]> };
  children?: ElementInput[];
}

const styleRefs = z.object({
  base: z.array(z.string()).optional(),
  slots: z.record(z.string(), z.array(z.string())).optional()
});

const elementInput: z.ZodType<ElementInput> = z.lazy(() =>
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

const position = z.enum(['inside', 'before', 'after']);
const scalar = z.union([z.string(), z.number(), z.boolean()]);

export const elementOps = {
  upsertElement: z.object({
    type: z.literal('upsertElement'),
    pageRef: z.string().describe('Page ref or id'),
    element: elementInput,
    parentRef: z.string().optional().describe('Anchor ref/id; defaults to page root'),
    position: position.optional()
  }),
  deleteElement: z.object({ type: z.literal('deleteElement'), pageRef: z.string(), ref: z.string() }),
  moveElement: z.object({
    type: z.literal('moveElement'),
    pageRef: z.string(),
    ref: z.string(),
    toParentRef: z.string(),
    position
  }),
  upsertPage: z.object({
    type: z.literal('upsertPage'),
    ref: z.string(),
    label: z.string().optional(),
    slug: z.string().optional(),
    folder: z.string().optional(),
    default: z.boolean().optional()
  }),
  deletePage: z.object({ type: z.literal('deletePage'), ref: z.string() }),
  upsertVariable: z.object({
    type: z.literal('upsertVariable'),
    name: z.string(),
    variableType: z.string().describe('Runtime type (text|number|...); NOT the `type` discriminator'),
    value: scalar,
    category: z.string().optional(),
    subValues: z.array(z.object({ when: z.unknown(), value: scalar })).optional()
  }),
  deleteVariable: z.object({ type: z.literal('deleteVariable'), name: z.string() })
};
