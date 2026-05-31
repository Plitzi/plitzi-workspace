import { z } from 'zod';

import { getAllowedModes } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const createCollectionRecordTool: McpTool = {
  name: 'create_collection_record',
  adapterName: 'createCollectionRecord',
  mcpDefinition: {
    title: 'Create Collection Record',
    // eslint-disable-next-line quotes
    description: "Create a new record in a collection. Pass field values matching the collection's field definitions.",
    inputSchema: z.object({
      collectionId: z.string().describe('Collection ID'),
      values: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
        .describe(
          'Field values keyed by field name — keys must match the collection field definitions (see get_collection)'
        ),
      status: z.enum(['draft', 'published']).optional().describe('Publication status; defaults to "draft"')
    }),
    outputSchema: z
      .object({
        id: z.string().describe('Record ID'),
        collectionId: z.string().describe('Collection ID')
      })
      .catchall(z.unknown())
      .describe('The created record')
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default createCollectionRecordTool;
