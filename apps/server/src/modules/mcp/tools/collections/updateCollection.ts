import { z } from 'zod';

import { getAllowedModes } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const updateCollectionTool: McpTool = {
  name: 'update_collection',
  adapterName: 'updateCollection',
  mcpDefinition: {
    title: 'Update Collection',
    description: 'Update an existing collection — rename, change privacy, or modify field definitions.',
    inputSchema: z.object({
      collectionId: z.string().describe('Collection ID'),
      updates: z
        .object({
          name: z.string().optional().describe('Singular collection name'),
          namePlural: z.string().optional().describe('Plural collection name'),
          description: z.string().optional().describe('Short description of what this collection stores'),
          privacy: z.enum(['public', 'private']).optional().describe('"public" allows unauthenticated reads; "private" requires auth'),
          fields: z.record(z.string(), z.unknown()).optional().describe('Updated field definitions keyed by field name')
        })
        .describe('Fields to update — only the provided fields are changed')
    }),
    outputSchema: z.object({
      data: z
        .object({
          id: z.string().describe('Collection ID'),
          name: z.string().describe('Collection name')
        })
        .catchall(z.unknown())
        .describe('The updated collection')
    })
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default updateCollectionTool;
