import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const moveSegmentElementTool: McpToolAdapterDefinition = {
  name: 'move_segment_element',
  adapterName: 'moveSegmentElement',
  description: 'Move an element inside a segment',
  inputSchema: z.object({
    segmentId: z.string(),
    elementId: z.string(),
    toParentId: z.string(),
    dropPosition: z.enum(['top', 'bottom', 'left', 'right', 'inside', 'custom']).optional()
  }),
  operationType: 'write'
};

export default moveSegmentElementTool;
