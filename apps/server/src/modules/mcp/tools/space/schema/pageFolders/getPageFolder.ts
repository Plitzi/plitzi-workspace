import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';
import { pageFolderSchema } from '../schemas';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  folderId: z.string().describe('ID of the page folder to retrieve')
});

const outputSchema = pageFolderSchema.nullable().describe('The page folder, or null if not found');

const getPageFolderTool: McpTool = {
  name: 'get_page_folder',
  adapterName: 'getPageFolder',
  mcpDefinition: {
    title: 'Get Page Folder',
    description:
      'Get a specific page folder by ID.\n\n' +
      'Use get_page_folders to list all available folder IDs first if you do not know the target folder ID.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default getPageFolderTool;
