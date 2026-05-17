import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  name: z.string().describe('Name of the page folder'),
  parentId: z.string().optional().describe('Parent folder ID')
});

const createPageFolderTool: McpTool = {
  name: 'create_page_folder',
  adapterName: 'createPageFolder',
  mcpDefinition: {
    title: 'Create Page Folder',
    description:
      'Create a new page folder to organize pages.\n\n' +
      '━━ REQUIRED INPUT ━━\n' +
      'name: Name of the page folder\n\n' +
      '━━ OPTIONAL INPUT ━━\n' +
      'parentId: Parent folder ID (omit for root level)',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default createPageFolderTool;
