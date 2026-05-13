import { z } from 'zod';

import { createTool, callAdapter } from '../../utils';

const updatePageFolderTool = createTool<'updatePageFolder'>(
  'update_page_folder',
  'Update a page folder',
  z.object({
    id: z.string(),
    updates: z.object({ name: z.string().optional(), slug: z.string().optional(), parentId: z.string().optional() })
  }),
  'write',
  (args, adapters, ctx) => callAdapter('updatePageFolder', args, adapters, ctx)
);

export default updatePageFolderTool;
