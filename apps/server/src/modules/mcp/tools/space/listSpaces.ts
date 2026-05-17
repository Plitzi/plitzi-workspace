import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

const listSpacesTool: McpTool = {
  name: 'list_spaces',
  adapterName: 'listSpaces',
  mcpDefinition: {
    title: 'List Spaces',
    description:
      'List all spaces available for the current user.\n\n' +
      '━━ INPUT ━━\n' +
      'No input required — uses the authenticated user context.\n\n' +
      '━━ OUTPUT ━━\n' +
      'Returns an array of spaces with: id, name, description, createdAt.',
    inputSchema
  },
  definition: {
    operationType: 'read',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('read')
  }
};

export default listSpacesTool;
