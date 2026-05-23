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

const outputSchema = z.object({
  data: z
    .object({
      id: z.string().describe('Folder ID'),
      name: z.string().describe('Folder name'),
      slug: z.string().describe('Folder slug'),
      parentId: z.string().optional().describe('Parent folder ID')
    })
    .describe('The updated page folder')
});

const updatePageFolderTool: McpTool = {
  name: 'update_page_folder',
  adapterName: 'updatePageFolder',
  mcpDefinition: {
    title: 'Update Page Folder',
    description: 'Update a page folder.',
    inputSchema,
    outputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default updatePageFolderTool;
