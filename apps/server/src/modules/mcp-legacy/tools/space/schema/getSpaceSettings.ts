import { z } from 'zod';

import { getAllowedModes } from '../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

const settingsSchema = z.object({
  customCss: z.string().optional().describe('Custom CSS injected into every page'),
  keepState: z.boolean().optional().describe('Persist UI state across navigation'),
  stateStorage: z
    .enum(['localStorage', 'sessionStorage', ''])
    .nullable()
    .optional()
    .describe('State storage mechanism'),
  userProvider: z.enum(['auth0', 'basic', 'custom', '']).optional().describe('Authentication provider'),
  auth0Domain: z.string().optional(),
  auth0ClientId: z.string().optional(),
  tokenStorage: z.enum(['localStorage', 'sessionStorage', '']).optional(),
  loginUrl: z.string().optional(),
  userUrl: z.string().optional(),
  refreshUrl: z.string().optional(),
  logoutUrl: z.string().optional(),
  detailsPath: z.string().optional(),
  tokenPath: z.string().optional(),
  refreshTokenPath: z.string().optional(),
  expirationTimePath: z.string().optional(),
  head: z.string().optional()
});

const outputSchema = settingsSchema.nullable().describe('Current space settings, or null if space not found');

const getSpaceSettingsTool: McpTool = {
  name: 'get_space_settings',
  adapterName: 'getSpaceSettings',
  mcpDefinition: {
    title: 'Get Space Settings',
    description:
      'Read the current space settings — custom CSS, authentication provider, state storage, and other configuration.\n\n' +
      'Use before update_space_settings to understand the current configuration.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default getSpaceSettingsTool;
