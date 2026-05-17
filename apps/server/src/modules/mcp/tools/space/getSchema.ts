import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

const getSchemaTool: McpTool = {
  name: 'get_schema',
  adapterName: 'getSchema',
  mcpDefinition: {
    title: 'Get Schema',
    description:
      'Get the full element tree for the current space and environment.\n\n' +
      '━━ INPUT ━━\n' +
      'No input required — uses current space and environment from context.\n\n' +
      '━━ OUTPUT ━━\n' +
      'Returns the complete schema: flat (all elements), variables, settings.',
    inputSchema
  },
  definition: {
    operationType: 'read',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('read')
  }
};

export default getSchemaTool;
