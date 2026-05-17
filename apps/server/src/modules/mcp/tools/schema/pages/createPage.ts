import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  name: z.string().describe('Name of the page to create')
});

const createPageTool: McpTool = {
  name: 'create_page',
  adapterName: 'createPage',
  mcpDefinition: {
    title: 'Create Page',
    description:
      'Create a new page in the space.\n\n' +
      '━━ REQUIRED INPUT ━━\n' +
      'name: Name of the new page\n\n' +
      '━━ OUTPUT ━━\n' +
      'Returns the created page with its generated ID.',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default createPageTool;
