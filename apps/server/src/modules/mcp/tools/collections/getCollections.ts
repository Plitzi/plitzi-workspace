import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const getCollectionsTool: McpTool = {
  name: 'get_collections',
  adapterName: 'getCollections',
  mcpDefinition: {
    title: 'Get Collections',
    description: 'Get all collections for the current space.',
    inputSchema: z.object({})
  },
  definition: {
    operationType: 'read',
    parameters: zodToJsonSchema(z.object({})),
    allowedModes: getAllowedModes('read')
  }
};

export default getCollectionsTool;