import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const getCollectionsTool: McpTool = {
  name: 'get_collections',
  adapterName: 'getCollections',
  mcpDefinition: {
    title: 'Get Collections',
    description: 'Get all collections for the current space.',
    inputSchema: z.object({}),
    outputSchema: z.object({
      data: z.array(z.record(z.string(), z.unknown())).describe('Array of collections in the space')
    })
  },
  definition: {
    operationType: 'read',
    parameters: zodToJsonSchema(z.object({})),
    allowedModes: getAllowedModes('read')
  }
};

export default getCollectionsTool;
