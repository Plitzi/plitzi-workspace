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
  name: z.string().describe('Name of the page to create')
});

const outputSchema = z.object({
  data: elementSchema.describe('The created page')
});

const createPageTool: McpTool = {
  name: 'create_page',
  adapterName: 'createPage',
  mcpDefinition: {
    title: 'Create Page',
    description: 'Create a new page in the space. Returns the page element — use its id to add child elements via create_element.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default createPageTool;
