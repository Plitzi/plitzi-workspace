import { z } from 'zod';

import { getAllowedModes } from '../../helpers';

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
    outputSchema: z
      .object({
        id: z.string().describe('Collection ID'),
        name: z.string().describe('Collection name'),
        namePlural: z.string().describe('Plural collection name'),
        fields: z.record(z.string(), z.unknown()).describe('Field definitions keyed by field name')
      })
      .catchall(z.unknown())
      .nullable()
      .describe('The collection object, or null if not found')
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default getCollectionTool;
