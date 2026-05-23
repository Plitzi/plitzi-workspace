import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const getCollectionTool: McpTool = {
  name: 'get_collection',
  adapterName: 'getCollection',
  mcpDefinition: {
    title: 'Get Collection',
    description: 'Get a specific collection by ID.',
    inputSchema: z.object({
      collectionId: z.string().describe('Collection ID')
    }),
    outputSchema: z.object({
      data: z.record(z.string(), z.unknown()).nullable().describe('The collection object, or null if not found')
    })
  },
  definition: {
    operationType: 'read',
    parameters: zodToJsonSchema(
      z.object({
        collectionId: z.string().describe('Collection ID')
      })
    ),
    allowedModes: getAllowedModes('read')
  }
};

export default getCollectionTool;
