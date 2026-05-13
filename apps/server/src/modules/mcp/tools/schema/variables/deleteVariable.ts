import { z } from 'zod';

import { createTool, callAdapter } from '../../utils';

const deleteVariableTool = createTool<'deleteVariable'>(
  'delete_variable',
  'Delete a schema variable',
  z.object({ name: z.string() }),
  'write',
  (args, adapters, ctx) => callAdapter('deleteVariable', args, adapters, ctx)
);

export default deleteVariableTool;
