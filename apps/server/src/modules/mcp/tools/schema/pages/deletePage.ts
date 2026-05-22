import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  pageId: z.string().describe('ID of the page to delete')
});

const deletePageTool: McpTool = {
  name: 'delete_page',
  adapterName: 'deletePage',
  mcpDefinition: {
    title: 'Delete Page',
    description: 'Delete a page by ID.',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default deletePageTool;
