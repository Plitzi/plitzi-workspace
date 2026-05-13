import { z } from 'zod';

import { createTool, callAdapter } from '../../utils';

const deletePageTool = createTool<'deletePage'>(
  'delete_page',
  'Delete a page by ID',
  z.object({ pageId: z.string() }),
  'write',
  (args, adapters, ctx) => callAdapter('deletePage', args, adapters, ctx)
);

export default deletePageTool;
