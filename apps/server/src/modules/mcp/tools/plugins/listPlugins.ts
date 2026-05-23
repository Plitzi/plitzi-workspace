import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

const outputSchema = z.object({
  data: z
    .array(
      z.object({
        name: z.string().describe('Plugin name'),
        version: z.string().optional().describe('Plugin version'),
        description: z.string().optional().describe('Plugin description')
      })
    )
    .describe('Array of available plugins')
});

const listPluginsTool: McpTool = {
  name: 'list_plugins',
  adapterName: 'listPlugins',
  mcpDefinition: {
    title: 'List Plugins',
    description: 'List all plugins available in the system.',
    inputSchema,
    outputSchema
  },
  definition: {
    operationType: 'read',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('read')
  }
};

export default listPluginsTool;
