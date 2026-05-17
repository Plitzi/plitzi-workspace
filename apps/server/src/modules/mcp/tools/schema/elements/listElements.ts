import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

const listElementsTool: McpTool = {
  name: 'list_elements',
  adapterName: 'listElements',
  mcpDefinition: {
    title: 'List Elements',
    description:
      'List all elements in the current space.\n\n' +
      '━━ INPUT ━━\n' +
      'No input required — uses the current space and environment from context.\n\n' +
      '━━ OUTPUT ━━\n' +
      'Returns an array of elements with: id, type, label, parentId.',
    inputSchema
  },
  definition: {
    operationType: 'read',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('read')
  }
};

export default listElementsTool;
