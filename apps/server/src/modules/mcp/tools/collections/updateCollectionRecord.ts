import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const updateCollectionRecordTool: McpTool = {
  name: 'update_collection_record',
  adapterName: 'updateCollectionRecord',
  mcpDefinition: {
    title: 'Update Collection Record',
    description: 'Update an existing record in a collection.',
    inputSchema: z.object({
      recordId: z.string().describe('Record ID'),
      values: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe('Record values'),
      status: z.enum(['draft', 'published', 'archived']).optional().describe('Record status')
    })
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(
      z.object({
        recordId: z.string().describe('Record ID'),
        values: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe('Record values'),
        status: z.enum(['draft', 'published', 'archived']).optional().describe('Record status')
      })
    ),
    allowedModes: getAllowedModes('write')
  }
};

export default updateCollectionRecordTool;