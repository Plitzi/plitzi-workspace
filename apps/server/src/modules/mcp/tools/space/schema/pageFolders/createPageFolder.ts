import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  name: z.string().describe('Name of the page folder'),
  parentId: z.string().optional().describe('Parent folder ID')
});

const outputSchema = z.object({
  data: z
    .object({
      id: z.string().describe('Folder ID'),
      name: z.string().describe('Folder name'),
      slug: z.string().describe('Folder slug'),
      parentId: z.string().optional().describe('Parent folder ID')
    })
    .describe('The created page folder')
});

const createPageFolderTool: McpTool = {
  name: 'create_page_folder',
  adapterName: 'createPageFolder',
  mcpDefinition: {
    title: 'Create Page Folder',
    description: 'Create a new page folder to organize pages.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default createPageFolderTool;
