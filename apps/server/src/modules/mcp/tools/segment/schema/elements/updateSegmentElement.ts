import { z } from 'zod';

import { createTool, callAdapter } from '../../../utils';

const updateSegmentElementTool = createTool<'updateSegmentElement'>(
  'update_segment_element',
  'Update an element inside a segment',
  z.object({
    segmentId: z.string(),
    elementId: z.string(),
    updates: z.object({ label: z.string().optional(), props: z.record(z.string(), z.unknown()).optional() })
  }),
  'write',
  (args, adapters, ctx) => callAdapter('updateSegmentElement', args, adapters, ctx)
);

export default updateSegmentElementTool;
