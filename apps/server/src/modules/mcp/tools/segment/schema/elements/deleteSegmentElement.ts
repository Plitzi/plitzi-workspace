import { z } from 'zod';

import { createTool, callAdapter } from '../../../utils';

const deleteSegmentElementTool = createTool<'deleteSegmentElement'>(
  'delete_segment_element',
  'Remove an element from a segment',
  z.object({ segmentId: z.string(), elementId: z.string() }),
  'write',
  (args, adapters, ctx) => callAdapter('deleteSegmentElement', args, adapters, ctx)
);

export default deleteSegmentElementTool;
