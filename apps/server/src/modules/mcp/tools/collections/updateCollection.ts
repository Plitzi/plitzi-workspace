import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const updateCollectionTool: McpTool = {
  name: 'update_collection',
  adapterName: 'updateCollection',
  mcpDefinition: {
    title: 'Update Collection',
    description: 'Update an existing collection.',
    inputSchema: z.object({
      collectionId: z.string().describe('Collection ID'),
      updates: z
        .object({
          name: z.string().optional(),
          namePlural: z.string().optional(),
          description: z.string().optional(),
          privacy: z.enum(['public', 'private']).optional(),
          fields: z.record(z.string(), z.unknown()).optional()
        })
        .describe('Fields to update')
    }),
    outputSchema: z.object({
      data: z.object({
        id: z.string().describe('Collection ID'),
        name: z.string().describe('Collection name')
      }).catchall(z.unknown()).describe('The updated collection')
    })
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(
      z.object({
        collectionId: z.string().describe('Collection ID'),
        updates: z
          .object({
            name: z.string().optional(),
            namePlural: z.string().optional(),
            description: z.string().optional(),
            privacy: z.enum(['public', 'private']).optional(),
            fields: z.record(z.string(), z.unknown()).optional()
          })
          .describe('Fields to update')
      })
    ),
    allowedModes: getAllowedModes('write')
  }
};

export default updateCollectionTool;
