import { z } from 'zod';

import { createTool, callAdapter } from '../../utils';

const deletePageFolderTool = createTool<'deletePageFolder'>(
  'delete_page_folder',
  'Delete a page folder',
  z.object({ id: z.string() }),
  'write',
  (args, adapters, ctx) => callAdapter('deletePageFolder', args, adapters, ctx)
);

export default deletePageFolderTool;
