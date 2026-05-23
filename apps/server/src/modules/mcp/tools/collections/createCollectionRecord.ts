import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const createCollectionRecordTool: McpTool = {
  name: 'create_collection_record',
  adapterName: 'createCollectionRecord',
  mcpDefinition: {
    title: 'Create Collection Record',
    description: 'Create a new record in a collection.',
    inputSchema: z.object({
      collectionId: z.string().describe('Collection ID'),
      values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).describe('Record values'),
      status: z.enum(['draft', 'published']).optional().describe('Record status')
    }),
    outputSchema: z.object({
      data: z
        .object({
          id: z.string().describe('Record ID'),
          collectionId: z.string().describe('Collection ID')
        })
        .catchall(z.unknown())
        .describe('The created record')
    })
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(
      z.object({
        collectionId: z.string().describe('Collection ID'),
        values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).describe('Record values'),
        status: z.enum(['draft', 'published']).optional().describe('Record status')
      })
    ),
    allowedModes: getAllowedModes('write')
  }
};

export default createCollectionRecordTool;
