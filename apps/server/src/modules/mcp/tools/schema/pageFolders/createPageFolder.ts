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
    description: 'Create a new page folder',
    inputSchema
  },
  definition: {
    shortDescription: 'Create a new page folder',
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default createPageFolderTool;
