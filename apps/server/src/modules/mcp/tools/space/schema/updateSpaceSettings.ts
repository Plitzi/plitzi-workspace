import { z } from 'zod';

import { getAllowedModes } from '../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  path: z
    .string()
    .optional()
    .describe(
      'Dot-notation path to the setting to update (e.g. "customCss", "auth0Domain"). Omit to replace all settings.'
    ),
  value: z
    .union([z.string(), z.number(), z.boolean()])
    .optional()
    .describe('New value for the setting at the given path')
});

const outputSchema = z.record(z.string(), z.unknown()).describe('Updated settings object');

const updateSpaceSettingsTool: McpTool = {
  name: 'update_space_settings',
  adapterName: 'updateSpaceSettings',
  mcpDefinition: {
    title: 'Update Space Settings',
    description:
      'Update a space setting at a specific path using dot notation.\n\n' +
      'Examples: set customCss with path="customCss", set auth provider with path="userProvider" value="auth0". ' +
      'Use get_space_settings first to read the current configuration.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default updateSpaceSettingsTool;
