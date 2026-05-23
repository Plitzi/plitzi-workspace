import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

const outputSchema = z.object({
  data: z
    .object({
      resources: z.array(z.unknown()).describe('List of resources for the current space')
    })
    .describe('Resources list')
});

const getResourcesTool: McpTool = {
  name: 'get_resources',
  adapterName: 'getResources',
  mcpDefinition: {
    title: 'Get Resources',
    description: 'List all resources for the current space and environment.',
    inputSchema,
    outputSchema
  },
  definition: {
    operationType: 'read',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('read')
  }
};

export default getResourcesTool;
