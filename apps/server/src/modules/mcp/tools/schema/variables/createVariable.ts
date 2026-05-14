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

const createVariableTool: McpToolAdapterDefinition = {
  name: 'create_variable',
  adapterName: 'createVariable',
  description: 'Create a schema variable',
  inputSchema: z.object({
    variable: z.object({ name: z.string(), type: variableTypesSchema, value: z.string(), category: z.string() })
  }),
  operationType: 'write'
};

export default createVariableTool;
