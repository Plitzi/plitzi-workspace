import { z } from 'zod';

import { createTool, callAdapter } from '../utils';

const listSpacesTool = createTool<'listSpaces'>(
  'list_spaces',
  'List all spaces available in the user',
  z.object({}),
  'read',
  (args, adapters, ctx) => callAdapter('listSpaces', args, adapters, ctx)
);

export default listSpacesTool;
