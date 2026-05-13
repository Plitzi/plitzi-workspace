import { z } from 'zod';

import { createTool, callAdapter } from '../../utils';

const deleteElementTool = createTool<'deleteElement'>(
  'delete_element',
  'Remove an element and all its descendants from the schema',
  z.object({ elementId: z.string() }),
  'write',
  (args, adapters, ctx) => callAdapter('deleteElement', args, adapters, ctx)
);

export default deleteElementTool;
