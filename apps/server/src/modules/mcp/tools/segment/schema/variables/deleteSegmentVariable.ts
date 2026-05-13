import { z } from 'zod';

import { createTool, callAdapter } from '../../../utils';

const deleteSegmentVariableTool = createTool<'deleteSegmentVariable'>(
  'delete_segment_variable',
  'Delete a segment schema variable',
  z.object({ segmentId: z.string(), name: z.string() }),
  'write',
  (args, adapters, ctx) => callAdapter('deleteSegmentVariable', args, adapters, ctx)
);

export default deleteSegmentVariableTool;
