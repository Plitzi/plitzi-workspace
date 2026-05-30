import { z } from 'zod';

import { getAllowedModes } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  pluginType: z.string().describe('Plugin type identifier to remove')
});

const outputSchema = z.boolean().describe('True if the plugin was removed successfully');

const removePluginTool: McpTool = {
  name: 'remove_plugin',
  adapterName: 'removePlugin',
  mcpDefinition: {
    title: 'Remove Plugin',
    description: 'Remove a plugin from the current space.\n\nUse list_plugins to see installed plugin types.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default removePluginTool;
