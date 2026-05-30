import { z } from 'zod';

import { getAllowedModes } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  pluginType: z.string().describe('Plugin type identifier to update'),
  resource: z.string().describe('New resource string for the plugin')
});

const outputSchema = z.object({
  type: z.string().describe('Plugin type'),
  resource: z.string().describe('Updated plugin resource'),
  settings: z.record(z.string(), z.unknown()).describe('Plugin settings')
});

const updatePluginTool: McpTool = {
  name: 'update_plugin',
  adapterName: 'updatePlugin',
  mcpDefinition: {
    title: 'Update Plugin',
    description:
      'Update the resource configuration of an installed plugin.\n\nUse list_plugins to see installed plugin types.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default updatePluginTool;
