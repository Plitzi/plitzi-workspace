import { z } from 'zod';

import { createTool, callAdapter } from '../../utils';

const createPageTool = createTool<'createPage'>(
  'create_page',
  'Create a new page in the space',
  z.object({ name: z.string() }),
  'write',
  (args, adapters, ctx) => callAdapter('createPage', args, adapters, ctx)
);

export default createPageTool;
