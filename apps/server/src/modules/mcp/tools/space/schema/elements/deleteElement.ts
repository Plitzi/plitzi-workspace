import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  elementId: z.string().describe('ID of the element to delete')
});

const outputSchema = z.literal(true).describe('Always true on successful deletion');

const deleteElementTool: McpTool = {
  name: 'delete_element',
  adapterName: 'deleteElement',
  mcpDefinition: {
    title: 'Delete Element',
    description: 'Remove an element and all its descendants from the schema. This action cannot be undone.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default deleteElementTool;
