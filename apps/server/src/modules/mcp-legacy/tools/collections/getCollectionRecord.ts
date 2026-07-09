import { z } from 'zod';

import { getAllowedModes } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const getCollectionRecordTool: McpTool = {
  name: 'get_collection_record',
  adapterName: 'getCollectionRecord',
  mcpDefinition: {
    title: 'Get Collection Record',
    description: 'Get a specific record from a collection.',
    inputSchema: z.object({
      recordId: z.string().describe('Record ID')
    }),
    outputSchema: z
      .object({
        id: z.string().describe('Record ID'),
        collectionId: z.string().describe('Collection ID'),
        values: z.record(z.string(), z.unknown()).describe('Field values keyed by field name'),
        status: z.enum(['draft', 'published', 'archived']).describe('Publication status')
      })
      .catchall(z.unknown())
      .nullable()
      .describe('The record, or null if not found')
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default getCollectionRecordTool;
