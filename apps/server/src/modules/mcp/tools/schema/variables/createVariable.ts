import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../helpers';

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

const createVariableTool: McpTool = {
  name: 'create_variable',
  adapterName: 'createVariable',
  mcpDefinition: {
    title: 'Create Variable',
    description:
      'Create a schema variable (a dynamic value that can be used in elements).\n\n' +
      '━━ REQUIRED INPUT ━━\n' +
      'variable.name: Variable name (used in templates as {{variable.name}})\n' +
      'variable.type: Variable type (text | number | email | password | select | select2 | checkbox | textarea | color | switch)\n' +
      'variable.value: Default value for the variable\n' +
      'variable.category: Category to group the variable',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default createVariableTool;
