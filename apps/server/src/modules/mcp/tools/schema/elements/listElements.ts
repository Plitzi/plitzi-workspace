import { z } from 'zod';

import { createTool, callAdapter } from '../../utils';

const listElementsTool = createTool<'listElements'>(
  'list_elements',
  'List all element IDs, types and labels for a space and environment',
  z.object({}),
  'read',
  (args, adapters, ctx) => callAdapter('listElements', args, adapters, ctx)
);

export default listElementsTool;
