import { z } from 'zod';

import { createTool, callAdapter } from '../../utils';

const createPageFolderTool = createTool<'createPageFolder'>(
  'create_page_folder',
  'Create a new page folder',
  z.object({ name: z.string(), parentId: z.string().optional() }),
  'write',
  (args, adapters, ctx) => callAdapter('createPageFolder', args, adapters, ctx)
);

export default createPageFolderTool;
