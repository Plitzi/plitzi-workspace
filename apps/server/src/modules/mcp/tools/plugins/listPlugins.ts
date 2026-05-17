import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

const listPluginsTool: McpTool = {
  name: 'list_plugins',
  adapterName: 'listPlugins',
  mcpDefinition: {
    title: 'List Plugins',
    description:
      'List all plugins available in the system.\n\n' +
      '━━ INPUT ━━\n' +
      'No input required.\n\n' +
      '━━ OUTPUT ━━\n' +
      'Returns an array of plugins with: id, name, version, description.',
    inputSchema
  },
  definition: {
    operationType: 'read',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('read')
  }
};

export default listPluginsTool;
