import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

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

const updateVariableTool: McpToolAdapterDefinition = {
  name: 'update_variable',
  adapterName: 'updateVariable',
  description: 'Update a schema variable',
  inputSchema: z.object({
    variable: z.object({
      name: z.string(),
      type: variableTypesSchema.optional(),
      value: z.string().optional(),
      category: z.string().optional()
    })
  }),
  operationType: 'write'
};

export default updateVariableTool;
