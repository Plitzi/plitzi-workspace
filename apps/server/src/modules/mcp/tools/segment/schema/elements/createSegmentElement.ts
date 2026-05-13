import { z } from 'zod';

import { createTool, callAdapter } from '../../../utils';

const createSegmentElementTool = createTool<'createSegmentElement'>(
  'create_segment_element',
  'Add an element to a segment',
  z.object({
    segmentId: z.string(),
    element: z.object({ type: z.string(), label: z.string(), props: z.record(z.string(), z.unknown()).optional() }),
    parentId: z.string()
  }),
  'write',
  (args, adapters, ctx) => callAdapter('createSegmentElement', args, adapters, ctx)
);

export default createSegmentElementTool;
