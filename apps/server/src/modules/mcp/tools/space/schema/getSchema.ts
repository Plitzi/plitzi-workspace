import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

const schemaVariableSchema = z.object({
  name: z.string().describe('Variable name'),
  category: z.string().describe('Variable category'),
  type: z
    .enum(['text', 'number', 'email', 'password', 'select', 'select2', 'checkbox', 'textarea', 'color', 'switch'])
    .describe('Variable type'),
  value: z.string().describe('Default value'),
  subValues: z
    .array(z.object({ when: z.record(z.string(), z.unknown()), value: z.string() }))
    .describe('Conditional sub-values')
});

const pageFolderSchema = z.object({
  id: z.string().describe('Folder ID'),
  name: z.string().describe('Folder name'),
  slug: z.string().describe('Folder slug'),
  parentId: z.string().optional().describe('Parent folder ID')
});

const elementSchema = z.object({
  id: z.string().describe('Element ID'),
  attributes: z.record(z.string(), z.unknown()).describe('Element attributes'),
  definition: z
    .object({
      rootId: z.string().describe('Root element ID'),
      label: z.string().describe('Element label'),
      type: z.string().describe('Element type'),
      parentId: z.string().optional().describe('Parent element ID'),
      items: z.array(z.string()).optional().describe('Child element IDs'),
      styleSelectors: z.record(z.string(), z.string()).describe('Style selector map'),
      runtime: z.enum(['server', 'client', 'shared']).optional().describe('Rendering runtime'),
      loadStrategy: z.enum(['eager', 'lazy', 'visible']).optional().describe('Load strategy')
    })
    .describe('Element definition')
});

const outputSchema = z.object({
  data: z
    .object({
      flat: z.record(z.string(), elementSchema).describe('Element map keyed by ID'),
      definition: z
        .object({
          name: z.string().describe('Schema name'),
          permanentUrl: z.string().describe('Permanent URL')
        })
        .describe('Schema metadata'),
      variables: z.array(schemaVariableSchema).describe('Schema variables'),
      settings: z
        .object({
          customCss: z.string().describe('Custom CSS'),
          keepState: z.boolean().optional().describe('Keep state across navigation'),
          stateStorage: z.enum(['localStorage', 'sessionStorage']).optional().describe('State storage mechanism'),
          userProvider: z.enum(['auth0', 'basic', 'custom', '']).optional().describe('User provider'),
          auth0Domain: z.string().optional(),
          auth0ClientId: z.string().optional(),
          tokenStorage: z.enum(['localStorage', 'sessionStorage', '']).optional().describe('Token storage'),
          loginUrl: z.string().optional(),
          userUrl: z.string().optional(),
          refreshUrl: z.string().optional(),
          logoutUrl: z.string().optional(),
          detailsPath: z.string().optional(),
          tokenPath: z.string().optional(),
          expirationTimePath: z.string().optional()
        })
        .describe('Schema settings'),
      rsc: z
        .object({
          enabled: z.boolean().optional().describe('RSC enabled'),
          transport: z.enum(['json', 'stream']).optional().describe('RSC transport protocol'),
          path: z.string().optional().describe('RSC endpoint path')
        })
        .optional()
        .describe('React Server Components config'),
      pages: z.array(z.string()).describe('Page element IDs'),
      pageFolders: z.array(pageFolderSchema).describe('Page folders')
    })
    .nullable()
    .describe('The full element tree, or null if not found')
});

const getSchemaTool: McpTool = {
  name: 'get_schema',
  adapterName: 'getSchema',
  mcpDefinition: {
    title: 'Get Schema',
    description: 'Get the full element tree for the current space and environment.',
    inputSchema,
    outputSchema
  },
  definition: {
    operationType: 'read',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('read')
  }
};

export default getSchemaTool;
