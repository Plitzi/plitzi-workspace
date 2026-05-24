import { z } from 'zod';

import { getAllowedModes } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const deleteCollectionRecordTool: McpTool = {
  name: 'delete_collection_record',
  adapterName: 'deleteCollectionRecord',
  mcpDefinition: {
    title: 'Delete Collection Record',
    description: 'Delete a record from a collection.',
    inputSchema: z.object({
      recordId: z.string().describe('Record ID')
    }),
    outputSchema: z.object({
      data: z.literal(true).describe('Always true on successful deletion')
    })
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default deleteCollectionRecordTool;
