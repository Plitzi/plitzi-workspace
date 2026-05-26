import { z } from 'zod';

import { getAllowedModes } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const getCollectionRecordsTool: McpTool = {
  name: 'get_collection_records',
  adapterName: 'getCollectionRecords',
  mcpDefinition: {
    title: 'Get Collection Records',
    description: 'List records from a collection, with optional filtering and result cap.',
    inputSchema: z.object({
      collectionId: z.string().describe('Collection ID'),
      filter: z.record(z.string(), z.unknown()).optional().describe('Key-value filter map — each key is a field name and value is the value to match'),
      limit: z.number().optional().describe('Maximum number of records to return')
    }),
    outputSchema: z.object({
      data: z
        .array(
          z
            .object({
              id: z.string().describe('Record ID'),
              collectionId: z.string().describe('Collection ID'),
              values: z.record(z.string(), z.unknown()).describe('Field values keyed by field name'),
              status: z.enum(['draft', 'published', 'archived']).describe('Publication status')
            })
            .catchall(z.unknown())
        )
        .describe('Array of records in the collection')
    })
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default getCollectionRecordsTool;
