import { z } from 'zod';

import { createTool, callAdapter } from '../utils';

const deleteSegmentTool = createTool<'deleteSegment'>(
  'delete_segment',
  'Delete a segment',
  z.object({ segmentId: z.string() }),
  'write',
  (args, adapters, ctx) => callAdapter('deleteSegment', args, adapters, ctx)
);

export default deleteSegmentTool;
