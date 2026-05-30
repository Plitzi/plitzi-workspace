import { z } from 'zod';

export const elementDefinitionSchema = z
  .object({
    rootId: z.string().describe('Root element ID'),
    label: z.string().describe('Element label'),
    type: z.string().describe('Element type'),
    parentId: z.string().optional().describe('Parent element ID'),
    items: z.array(z.string()).optional().describe('Child element IDs'),
    runtime: z.enum(['server', 'client', 'shared']).optional().describe('Rendering runtime'),
    loadStrategy: z.enum(['eager', 'lazy', 'visible']).optional().describe('Load strategy')
  })
  .describe('Element definition');

export const elementSchema = z.object({
  id: z.string().describe('Element ID'),
  attributes: z.record(z.string(), z.unknown()).describe('Element attributes'),
  definition: elementDefinitionSchema
});

export const pageFolderSchema = z.object({
  id: z.string().describe('Folder ID'),
  name: z.string().describe('Folder name'),
  slug: z.string().describe('Folder slug'),
  parentId: z.string().optional().describe('Parent folder ID')
});

export const schemaVariableSchema = z.object({
  name: z.string().describe('Variable name'),
  category: z.string().nullable().describe('Variable category'),
  type: z
    .enum(['text', 'number', 'email', 'password', 'select', 'select2', 'checkbox', 'textarea', 'color', 'switch'])
    .describe('Variable type'),
  value: z.string().describe('Default value'),
  subValues: z
    .array(z.object({ when: z.record(z.string(), z.unknown()), value: z.string() }))
    .describe('Conditional sub-values')
});
