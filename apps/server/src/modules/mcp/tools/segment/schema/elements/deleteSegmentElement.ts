import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const deleteSegmentElementTool: McpToolAdapterDefinition = {
  name: 'delete_segment_element',
  adapterName: 'deleteSegmentElement',
  description: 'Remove an element from a segment',
  inputSchema: z.object({ segmentId: z.string(), elementId: z.string() }),
  operationType: 'write'
};

export default deleteSegmentElementTool;
