import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  id: z.string().describe('Page folder ID to delete')
});

const deletePageFolderTool: McpTool = {
  name: 'delete_page_folder',
  adapterName: 'deletePageFolder',
  mcpDefinition: {
    title: 'Delete Page Folder',
    description:
      'Delete a page folder.\n\n' +
      '━━ REQUIRED INPUT ━━\n' +
      'id: Page folder ID to delete\n\n' +
      '━━ WARNING ━━\n' +
      'This removes the folder but not the pages inside. Pages will be moved to root.',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default deletePageFolderTool;
