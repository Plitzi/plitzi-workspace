import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const updateSegmentTool: McpToolAdapterDefinition = {
  name: 'update_segment',
  adapterName: 'updateSegment',
  description: 'Update a segment',
  inputSchema: z.object({
    segmentId: z.string(),
    updates: z.object({ name: z.string().optional(), description: z.string().optional() })
  }),
  operationType: 'write'
};

export default updateSegmentTool;
