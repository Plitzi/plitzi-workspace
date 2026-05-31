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
      type: variableTypesSchema.optional().describe('Variable type'),
      value: z.string().optional().describe('Variable value'),
      category: z.string().optional().describe('Grouping label shown in the builder UI')
    })
    .describe('Variable fields to update')
});

const outputSchema = z
  .object({
    name: z.string().describe('Variable name'),
    type: z.string().describe('Variable type'),
    value: z.string().describe('Variable value'),
    category: z.string().describe('Variable category')
  })
  .describe('The updated variable');

const updateVariableTool: McpTool = {
  name: 'update_variable',
  adapterName: 'updateSchemaVariable',
  mcpDefinition: {
    title: 'Update Variable',
    description: 'Update an existing schema variable. Identified by name; only the provided fields are changed.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default updateVariableTool;
