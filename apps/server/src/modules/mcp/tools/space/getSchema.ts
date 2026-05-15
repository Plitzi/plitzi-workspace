import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

const getSchemaTool: McpTool = {
  name: 'get_schema',
  adapterName: 'getSchema',
  mcpDefinition: {
    title: 'Get Schema',
    description: 'Get the full element tree for a space and environment',
    inputSchema
  },
  definition: {
    shortDescription: 'Get the full element tree for a space and environment',
    operationType: 'read',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('read')
  }
};

export default getSchemaTool;
