import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const updateSegmentElementTool: McpToolAdapterDefinition = {
  name: 'update_segment_element',
  adapterName: 'updateSegmentElement',
  description: 'Update an element inside a segment',
  inputSchema: z.object({
    segmentId: z.string(),
    elementId: z.string(),
    updates: z.object({ label: z.string().optional(), props: z.record(z.string(), z.unknown()).optional() })
  }),
  operationType: 'write'
};

export default updateSegmentElementTool;
