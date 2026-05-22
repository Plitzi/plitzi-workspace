import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

const listSpacesTool: McpTool = {
  name: 'list_spaces',
  adapterName: 'listSpaces',
  mcpDefinition: {
    title: 'List Spaces',
    description: 'List all spaces available for the current user.',
    inputSchema
  },
  definition: {
    operationType: 'read',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('read')
  }
};

export default listSpacesTool;
