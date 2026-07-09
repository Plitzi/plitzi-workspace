import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  rootId: z.string().optional().describe('Filter to elements belonging to a specific page (by page element ID)'),
  parentId: z.string().optional().describe('Filter to direct children of a specific element'),
  type: z.string().optional().describe('Filter by element type (e.g. "button", "box", "text")')
});

const compactElementSchema = z.object({
  id: z.string().describe('Element ID'),
  label: z.string().describe('Element label'),
  type: z.string().describe('Element type'),
  parentId: z.string().nullish().describe('Parent element ID (null for root elements)'),
  items: z.array(z.string()).optional().describe('Child element IDs')
});

const outputSchema = z.array(compactElementSchema).describe('Matching elements as compact summaries');

const listElementsTool: McpTool = {
  name: 'list_elements',
  adapterName: 'listElements',
  mcpDefinition: {
    title: 'List Elements',
    description:
      'List elements in the space as compact summaries (id, label, type, parentId, items).\n\n' +
      'Use rootId to scope to a specific page, parentId to get direct children of an element, ' +
      'or type to find all elements of a certain kind. Filters combine with AND logic. ' +
      'Use get_element for the full details of a specific element.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default listElementsTool;
