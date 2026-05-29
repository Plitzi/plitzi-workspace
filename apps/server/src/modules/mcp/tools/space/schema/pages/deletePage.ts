import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  pageId: z.string().describe('ID of the page to delete')
});

const outputSchema = z.object({
  data: z.literal(true).describe('Always true on successful deletion')
});

const deletePageTool: McpTool = {
  name: 'delete_page',
  adapterName: 'deletePage',
  mcpDefinition: {
    title: 'Delete Page',
    description: 'Delete a page and all its child elements. This action cannot be undone.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default deletePageTool;
