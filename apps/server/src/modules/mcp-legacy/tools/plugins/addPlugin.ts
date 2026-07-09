import { z } from 'zod';

import { getAllowedModes } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  pluginType: z.string().describe('Plugin type identifier'),
  resource: z.string().describe('Plugin resource string'),
  override: z.boolean().optional().describe('Whether to override if the plugin already exists (default: false)')
});

const outputSchema = z.object({
  type: z.string().describe('Plugin type'),
  resource: z.string().describe('Plugin resource'),
  settings: z.record(z.string(), z.unknown()).describe('Plugin settings')
});

const addPluginTool: McpTool = {
  name: 'add_plugin',
  adapterName: 'addPlugin',
  mcpDefinition: {
    title: 'Add Plugin',
    description:
      'Add a plugin to the current space.\n\nUse list_plugins to see available plugin types first. ' +
      'Set override: true to replace an existing plugin of the same type.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default addPluginTool;
