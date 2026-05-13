import { z } from 'zod';

import { createTool, callAdapter } from '../utils';

const createSegmentTool = createTool<'createSegment'>(
  'create_segment',
  'Create a new segment',
  z.object({ name: z.string(), description: z.string() }),
  'write',
  (args, adapters, ctx) => callAdapter('createSegment', args, adapters, ctx)
);

export default createSegmentTool;
