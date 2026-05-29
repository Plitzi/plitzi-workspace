import { z } from 'zod';

import { getAllowedModes } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const updateCollectionRecordTool: McpTool = {
  name: 'update_collection_record',
  adapterName: 'updateCollectionRecord',
  mcpDefinition: {
    title: 'Update Collection Record',
    description: 'Update an existing collection record. Only the provided values and status are changed.',
    inputSchema: z.object({
      recordId: z.string().describe('Record ID'),
      values: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
        .optional()
        .describe('Field values to update, keyed by field name. Only the provided fields are changed.'),
      status: z.enum(['draft', 'published', 'archived']).optional().describe('Publication status: "draft", "published", or "archived"')
    }),
    outputSchema: z.object({
      data: z
        .object({
          id: z.string().describe('Record ID'),
          collectionId: z.string().describe('Collection ID')
        })
        .catchall(z.unknown())
        .describe('The updated record')
    })
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default updateCollectionRecordTool;
