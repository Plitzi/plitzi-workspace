import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const deleteCollectionTool: McpTool = {
  name: 'delete_collection',
  adapterName: 'deleteCollection',
  mcpDefinition: {
    title: 'Delete Collection',
    description: 'Delete a collection.',
    inputSchema: z.object({
      collectionId: z.string().describe('Collection ID')
    }),
    outputSchema: z.object({
      data: z.literal(true).describe('Always true on successful deletion')
    })
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(
      z.object({
        collectionId: z.string().describe('Collection ID')
      })
    ),
    allowedModes: getAllowedModes('write')
  }
};

export default deleteCollectionTool;
