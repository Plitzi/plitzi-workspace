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
      type: variableTypesSchema.optional().describe('Variable type'),
      value: z.string().optional().describe('Variable value'),
      category: z.string().optional().describe('Variable category')
    })
    .describe('Variable fields to update')
});

const updateVariableTool: McpTool = {
  name: 'update_variable',
  adapterName: 'updateVariable',
  mcpDefinition: {
    title: 'Update Variable',
    description:
      'Update an existing schema variable.\n\n' +
      '━━ REQUIRED INPUT ━━\n' +
      'variable.name: Name of the variable to update\n\n' +
      '━━ OPTIONAL INPUT ━━\n' +
      'variable.type: New variable type (text | number | email | password | select | select2 | checkbox | textarea | color | switch)\n' +
      'variable.value: New default value\n' +
      'variable.category: New category',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default updateVariableTool;
