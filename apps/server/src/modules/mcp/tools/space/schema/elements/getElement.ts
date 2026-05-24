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
      styleSelectors: z.record(z.string(), z.string()).describe('Style selector map'),
      runtime: z.enum(['server', 'client', 'shared']).optional().describe('Rendering runtime'),
      loadStrategy: z.enum(['eager', 'lazy', 'visible']).optional().describe('Load strategy')
    })
    .describe('Element definition')
});

const inputSchema = z.object({
  elementId: z.string().describe('Element ID')
});

const outputSchema = z.object({
  data: elementSchema.nullable().describe('The full element details, or null if not found')
});

const getElementTool: McpTool = {
  name: 'get_element',
  adapterName: 'getElement',
  mcpDefinition: {
    title: 'Get Element',
    description: 'Get the full details of a single element by ID.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default getElementTool;
