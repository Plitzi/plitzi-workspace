import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const variableTypesSchema = z.enum([
  'text',
  'number',
  'email',
  'password',
  'select',
  'select2',
  'checkbox',
  'textarea',
  'color',
  'switch'
]);

const inputSchema = z.object({
  variable: z
    .object({
      name: z.string().describe('Variable name'),
      type: variableTypesSchema.describe('Variable type'),
      value: z.string().describe('Variable default value'),
      category: z.string().describe('Variable category')
    })
    .describe('Variable to create')
});

const outputSchema = z.object({
  data: z
    .object({
      name: z.string().describe('Variable name'),
      type: z.string().describe('Variable type'),
      value: z.string().describe('Variable value'),
      category: z.string().describe('Variable category')
    })
    .describe('The created variable')
});

const createVariableTool: McpTool = {
  name: 'create_variable',
  adapterName: 'createSchemaVariable',
  mcpDefinition: {
    title: 'Create Variable',
    description: 'Create a schema variable (a dynamic value used in elements).',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default createVariableTool;
