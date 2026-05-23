import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../../helpers';

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
    description: 'Delete a page by ID.',
    inputSchema,
    outputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default deletePageTool;
