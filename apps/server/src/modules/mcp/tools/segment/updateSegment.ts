import { z } from 'zod';

import { createTool, callAdapter } from '../utils';

const updateSegmentTool = createTool<'updateSegment'>(
  'update_segment',
  'Update a segment',
  z.object({
    segmentId: z.string(),
    updates: z.object({ name: z.string().optional(), description: z.string().optional() })
  }),
  'write',
  (args, adapters, ctx) => callAdapter('updateSegment', args, adapters, ctx)
);

export default updateSegmentTool;
