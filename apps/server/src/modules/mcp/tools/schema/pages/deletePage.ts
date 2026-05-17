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
    description:
      'Delete a page by ID.\n\n' +
      '━━ REQUIRED INPUT ━━\n' +
      'pageId: ID of the page to delete\n\n' +
      '━━ WARNING ━━\n' +
      'This permanently removes the page and all its elements.',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default deletePageTool;
