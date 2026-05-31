import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const elementSchema = z.object({
  id: z.string().describe('Element ID'),
  attributes: z.record(z.string(), z.unknown()).describe('Element attributes'),
  definition: z
    .object({
      rootId: z.string().describe('Root element ID'),
      label: z.string().describe('Element label'),
      type: z.string().describe('Element type'),
      parentId: z.string().optional().describe('Parent element ID'),
      items: z.array(z.string()).optional().describe('Child element IDs'),
      runtime: z.enum(['server', 'client', 'shared']).optional().describe('Rendering runtime'),
      loadStrategy: z.enum(['eager', 'lazy', 'visible']).optional().describe('Load strategy')
    })
    .describe('Element definition')
});

const inputSchema = z.object({
  element: z
    .object({
      type: z
        .string()
        .describe(
          'Element type identifier — determines which component renders this element. Get valid values from get_builder_context (elementDefaults keys) or by inspecting existing elements via get_schema.'
        ),
      label: z.string().describe('Human-readable name for the element'),
      props: z.record(z.string(), z.unknown()).optional().describe('Component props/attributes'),
      runtime: z.enum(['server', 'client', 'shared']).optional().describe('Rendering runtime')
    })
    .describe('Element to create'),
  parentId: z.string().optional().describe('Parent element ID; omit to place at root'),
  position: z.number().optional().describe('Zero-based insertion index within the parent')
});

const outputSchema = elementSchema.describe('The created element');

const createElementTool: McpTool = {
  name: 'create_element',
  adapterName: 'createElement',
  mcpDefinition: {
    title: 'Create Element',
    description: 'Add a new element (component instance) to the schema.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default createElementTool;
