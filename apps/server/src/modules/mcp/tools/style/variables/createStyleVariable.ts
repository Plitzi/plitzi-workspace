import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import { createTool, callAdapter } from '../../utils';

const createStyleVariableTool = createTool<'createStyleVariable'>(
  'create_style_variable',
  'Create a global style variable',
  z.object({
    category: z.nativeEnum(StyleVariableCategory),
    name: z.string(),
    value: z.union([z.string(), z.number(), z.record(z.string(), z.unknown())])
  }),
  'write',
  (args, adapters, ctx) => callAdapter('createStyleVariable', args, adapters, ctx)
);

export default createStyleVariableTool;
