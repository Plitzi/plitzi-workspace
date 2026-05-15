import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

const listSpacesTool: McpTool = {
  name: 'list_spaces',
  adapterName: 'listSpaces',
  mcpDefinition: {
    title: 'List Spaces',
    description: 'List all spaces available in the user',
    inputSchema
  },
  definition: {
    shortDescription: 'List all spaces available in the user',
    operationType: 'read',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('read')
  }
};

export default listSpacesTool;
