import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

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

const outputSchema = z.object({
  data: z.array(elementSchema).describe('Array of all elements in the space')
});

const listElementsTool: McpTool = {
  name: 'list_elements',
  adapterName: 'listElements',
  mcpDefinition: {
    title: 'List Elements',
    description:
      'List all elements in the space as a flat array.\n\n' +
      'Lighter than get_schema — returns only elements without variables, settings, pages, or folders. ' +
      'Use when you need to scan all elements by type or label.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default listElementsTool;
