import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const createSegmentElementTool: McpToolAdapterDefinition = {
  name: 'create_segment_element',
  adapterName: 'createSegmentElement',
  description: 'Add an element to a segment',
  inputSchema: z.object({
    segmentId: z.string(),
    element: z.object({ type: z.string(), label: z.string(), props: z.record(z.string(), z.unknown()).optional() }),
    parentId: z.string()
  }),
  operationType: 'write'
};

export default createSegmentElementTool;
