import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const deleteSegmentVariableTool: McpToolAdapterDefinition = {
  name: 'delete_segment_variable',
  adapterName: 'deleteSegmentVariable',
  description: 'Delete a segment schema variable',
  inputSchema: z.object({ segmentId: z.string(), name: z.string() }),
  operationType: 'write'
};

export default deleteSegmentVariableTool;
