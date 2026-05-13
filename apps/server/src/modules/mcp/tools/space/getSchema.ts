import { z } from 'zod';

import { createTool, callAdapter } from '../utils';

const getSchemaTool = createTool<'getSchema'>(
  'get_schema',
  'Get the full element tree for a space and environment',
  z.object({}),
  'read',
  (args, adapters, ctx) => callAdapter('getSchema', args, adapters, ctx)
);

export default getSchemaTool;
