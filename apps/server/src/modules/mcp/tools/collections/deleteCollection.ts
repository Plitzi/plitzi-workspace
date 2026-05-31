import { z } from 'zod';

import { getAllowedModes } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const deleteCollectionTool: McpTool = {
  name: 'delete_collection',
  adapterName: 'deleteCollection',
  mcpDefinition: {
    title: 'Delete Collection',
    description: 'Delete a collection and all its records permanently. This action cannot be undone.',
    inputSchema: z.object({
      collectionId: z.string().describe('Collection ID')
    }),
    outputSchema: z.literal(true).describe('Always true on successful deletion')
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default deleteCollectionTool;
