import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import { createTool, callAdapter } from '../../utils';

const updateStyleVariableTool = createTool<'updateStyleVariable'>(
  'update_style_variable',
  'Update a global style variable',
  z.object({
    category: z.nativeEnum(StyleVariableCategory),
    name: z.string(),
    value: z.union([z.string(), z.number(), z.record(z.string(), z.unknown())])
  }),
  'write',
  (args, adapters, ctx) => callAdapter('updateStyleVariable', args, adapters, ctx)
);

export default updateStyleVariableTool;
