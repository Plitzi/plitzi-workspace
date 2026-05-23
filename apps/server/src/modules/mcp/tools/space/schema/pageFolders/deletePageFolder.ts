import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  id: z.string().describe('Page folder ID to delete')
});

const outputSchema = z.object({
  data: z.literal(true).describe('Always true on successful deletion')
});

const deletePageFolderTool: McpTool = {
  name: 'delete_page_folder',
  adapterName: 'deletePageFolder',
  mcpDefinition: {
    title: 'Delete Page Folder',
    description: 'Delete a page folder. Pages inside are moved to root.',
    inputSchema,
    outputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default deletePageFolderTool;
