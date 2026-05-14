import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const deleteSegmentTool: McpToolAdapterDefinition = {
  name: 'delete_segment',
  adapterName: 'deleteSegment',
  description: 'Delete a segment',
  inputSchema: z.object({ segmentId: z.string() }),
  operationType: 'write'
};

export default deleteSegmentTool;
