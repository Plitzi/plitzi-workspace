import { z } from 'zod';

import { createTool, callAdapter } from '../../../utils';

const moveSegmentElementTool = createTool<'moveSegmentElement'>(
  'move_segment_element',
  'Move an element inside a segment',
  z.object({
    segmentId: z.string(),
    elementId: z.string(),
    toParentId: z.string(),
    dropPosition: z.enum(['top', 'bottom', 'left', 'right', 'inside', 'custom']).optional()
  }),
  'write',
  (args, adapters, ctx) => callAdapter('moveSegmentElement', args, adapters, ctx)
);

export default moveSegmentElementTool;
