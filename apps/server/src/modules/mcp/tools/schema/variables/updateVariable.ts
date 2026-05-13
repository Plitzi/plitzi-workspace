import { z } from 'zod';

import { createTool, callAdapter } from '../../utils';

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

const updateVariableTool = createTool<'updateVariable'>(
  'update_variable',
  'Update a schema variable',
  z.object({
    variable: z.object({
      name: z.string(),
      type: variableTypesSchema.optional(),
      value: z.string().optional(),
      category: z.string().optional()
    })
  }),
  'write',
  (args, adapters, ctx) => callAdapter('updateVariable', args, adapters, ctx)
);

export default updateVariableTool;
