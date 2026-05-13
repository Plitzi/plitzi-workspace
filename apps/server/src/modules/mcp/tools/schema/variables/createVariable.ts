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

const createVariableTool = createTool<'createVariable'>(
  'create_variable',
  'Create a schema variable',
  z.object({
    variable: z.object({ name: z.string(), type: variableTypesSchema, value: z.string(), category: z.string() })
  }),
  'write',
  (args, adapters, ctx) => callAdapter('createVariable', args, adapters, ctx)
);

export default createVariableTool;
