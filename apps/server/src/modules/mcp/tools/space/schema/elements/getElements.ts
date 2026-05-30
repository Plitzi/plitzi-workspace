import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';
import { elementSchema } from '../schemas';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  pageId: z
    .string()
    .optional()
    .describe('Filter elements by page (rootId). Returns only elements belonging to this page'),
  type: z.string().optional().describe('Filter elements by type (e.g. "button", "box", "text")'),
  parentId: z.string().optional().describe('Filter elements by direct parent ID')
});

const outputSchema = z.array(elementSchema).describe('Elements matching the provided filters');

const getElementsTool: McpTool = {
  name: 'get_elements',
  adapterName: 'getElements',
  mcpDefinition: {
    title: 'Get Elements',
    description:
      'Get elements from the space with optional filters.\n\n' +
      'Filters are combined with AND logic. Use pageId to scope to a specific page, type to find all elements of a certain kind, ' +
      'or parentId to get direct children of an element. ' +
      'For a full unfiltered element list use list_elements. For a single element use get_element.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default getElementsTool;
