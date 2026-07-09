import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';
import { elementSchema } from '../schemas';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  elementId: z.string().describe('Element ID')
});

const outputSchema = elementSchema.nullable().describe('The full element details, or null if not found');

const getElementTool: McpTool = {
  name: 'get_element',
  adapterName: 'getElement',
  mcpDefinition: {
    title: 'Get Element',
    description:
      'Get the full details of a single element by ID — attributes, definition, style selectors, bindings, and interactions. Lighter than get_schema when you only need one element.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default getElementTool;
