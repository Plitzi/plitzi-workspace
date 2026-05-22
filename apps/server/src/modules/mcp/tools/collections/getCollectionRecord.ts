import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const getCollectionRecordTool: McpTool = {
  name: 'get_collection_record',
  adapterName: 'getCollectionRecord',
  mcpDefinition: {
    title: 'Get Collection Record',
    description: 'Get a specific record from a collection.',
    inputSchema: z.object({
      recordId: z.string().describe('Record ID')
    })
  },
  definition: {
    operationType: 'read',
    parameters: zodToJsonSchema(
      z.object({
        recordId: z.string().describe('Record ID')
      })
    ),
    allowedModes: getAllowedModes('read')
  }
};

export default getCollectionRecordTool;