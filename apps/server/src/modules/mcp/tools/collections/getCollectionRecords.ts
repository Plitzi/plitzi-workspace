import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const getCollectionRecordsTool: McpTool = {
  name: 'get_collection_records',
  adapterName: 'getCollectionRecords',
  mcpDefinition: {
    title: 'Get Collection Records',
    description: 'Get all records from a collection.',
    inputSchema: z.object({
      collectionId: z.string().describe('Collection ID'),
      filter: z.record(z.any()).optional().describe('Filter criteria'),
      limit: z.number().optional().describe('Limit number of results')
    })
  },
  definition: {
    operationType: 'read',
    parameters: zodToJsonSchema(
      z.object({
        collectionId: z.string().describe('Collection ID'),
        filter: z.record(z.any()).optional().describe('Filter criteria'),
        limit: z.number().optional().describe('Limit number of results')
      })
    ),
    allowedModes: getAllowedModes('read')
  }
};

export default getCollectionRecordsTool;