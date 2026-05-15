import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

const listElementsTool: McpTool = {
  name: 'list_elements',
  adapterName: 'listElements',
  mcpDefinition: {
    title: 'List Elements',
    description: 'List all element IDs, types and labels for a space and environment',
    inputSchema
  },
  definition: {
    shortDescription: 'List all element IDs, types and labels for a space and environment',
    operationType: 'read',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('read')
  }
};

export default listElementsTool;
