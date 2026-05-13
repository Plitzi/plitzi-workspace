import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import { createTool, callAdapter } from '../../utils';

const deleteStyleVariableTool = createTool<'deleteStyleVariable'>(
  'delete_style_variable',
  'Delete a global style variable',
  z.object({ category: z.nativeEnum(StyleVariableCategory), name: z.string() }),
  'write',
  (args, adapters, ctx) => callAdapter('deleteStyleVariable', args, adapters, ctx)
);

export default deleteStyleVariableTool;
