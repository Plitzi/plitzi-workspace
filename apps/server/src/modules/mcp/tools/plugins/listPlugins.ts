import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

const listPluginsTool: McpTool = {
  name: 'list_plugins',
  adapterName: 'listPlugins',
  mcpDefinition: {
    title: 'List Plugins',
    description: 'List all plugins registered in the system',
    inputSchema
  },
  definition: {
    shortDescription: 'List all plugins registered in the system',
    operationType: 'read',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('read')
  }
};

export default listPluginsTool;
