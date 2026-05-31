import { z } from 'zod';

import { getAllowedModes } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const getCollectionsTool: McpTool = {
  name: 'get_collections',
  adapterName: 'getCollections',
  mcpDefinition: {
    title: 'Get Collections',
    description: 'Get all collections for the current space.',
    inputSchema: z.object({}),
    outputSchema: z
      .array(
        z
          .object({
            id: z.string().describe('Collection ID'),
            name: z.string().describe('Collection name')
          })
          .catchall(z.unknown())
      )
      .describe('Array of collections in the space')
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default getCollectionsTool;
