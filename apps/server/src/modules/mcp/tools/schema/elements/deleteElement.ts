import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  elementId: z.string().describe('ID of the element to delete')
});

const deleteElementTool: McpTool = {
  name: 'delete_element',
  adapterName: 'deleteElement',
  mcpDefinition: {
    title: 'Delete Element',
    description:
      'Remove an element and all its descendants from the schema.\n\n' +
      '━━ REQUIRED INPUT ━━\n' +
      'elementId: ID of the element to delete\n\n' +
      '━━ WARNING ━━\n' +
      'This deletes the element and ALL its child elements. This action cannot be undone.',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default deleteElementTool;
