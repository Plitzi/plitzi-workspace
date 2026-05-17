import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  elementId: z.string().describe('Element ID')
});

const getElementTool: McpTool = {
  name: 'get_element',
  adapterName: 'getElement',
  mcpDefinition: {
    title: 'Get Element',
    description:
      'Get the full details of a single element by ID.\n\n' +
      '━━ REQUIRED INPUT ━━\n' +
      'elementId: ID of the element to retrieve\n\n' +
      '━━ OUTPUT ━━\n' +
      'Returns the element with all its properties, props, and styles.',
    inputSchema
  },
  definition: {
    operationType: 'read',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('read')
  }
};

export default getElementTool;
