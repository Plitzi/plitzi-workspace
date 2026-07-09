import { z } from 'zod';

import { getAllowedModes } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

const outputSchema = z
  .array(
    z.object({
      name: z.string().describe('Plugin name'),
      version: z.string().optional().describe('Plugin version'),
      description: z.string().optional().describe('Plugin description')
    })
  )
  .describe('Array of available plugins');

const listPluginsTool: McpTool = {
  name: 'list_plugins',
  adapterName: 'listPlugins',
  mcpDefinition: {
    title: 'List Plugins',
    description:
      'List all plugins installed in the space — returns name, version, and description.\n\n' +
      'Plugins and element types are different concepts: this tool lists plugins (installed packages), not element type identifiers. ' +
      'To get valid type values for create_element, use get_builder_context (elementDefaults keys) or inspect existing elements via get_schema.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default listPluginsTool;
