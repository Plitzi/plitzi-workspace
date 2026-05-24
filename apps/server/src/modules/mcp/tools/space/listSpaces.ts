import { z } from 'zod';

import { getAllowedModes } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

const outputSchema = z.object({
  data: z
    .array(
      z.object({
        id: z.string().describe('Space ID'),
        name: z.string().describe('Space name'),
        permanentUrl: z.string().describe('Permanent URL of the space'),
        verified: z.boolean().describe('Whether the space is verified')
      })
    )
    .describe('List of available spaces')
});

const listSpacesTool: McpTool = {
  name: 'list_spaces',
  adapterName: 'listSpaces',
  mcpDefinition: {
    title: 'List Spaces',
    description: 'List all spaces available for the current user.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default listSpacesTool;
