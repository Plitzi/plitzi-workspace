import { z } from 'zod';

import { createTool, callAdapter } from '../utils';

const publishSchemaTool = createTool<'publishSchema'>(
  'publish_schema',
  'Publish the current draft schema as a new immutable revision',
  z.object({}),
  'admin',
  (args, adapters, ctx) => callAdapter('publishSchema', args, adapters, ctx)
);

export default publishSchemaTool;
