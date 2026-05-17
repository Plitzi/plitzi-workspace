import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  id: z.string().describe('Page folder ID'),
  updates: z
    .object({
      name: z.string().optional().describe('New name for the folder'),
      slug: z.string().optional().describe('New slug for the folder'),
      parentId: z.string().optional().describe('New parent folder ID')
    })
    .describe('Fields to update')
});

const updatePageFolderTool: McpTool = {
  name: 'update_page_folder',
  adapterName: 'updatePageFolder',
  mcpDefinition: {
    title: 'Update Page Folder',
    description:
      'Update a page folder.\n\n' +
      '━━ REQUIRED INPUT ━━\n' +
      'id: Page folder ID to update\n\n' +
      '━━ OPTIONAL UPDATES ━━\n' +
      'updates.name: New name for the folder\n' +
      'updates.slug: New slug for the folder\n' +
      'updates.parentId: New parent folder ID',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default updatePageFolderTool;
