import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const createSegmentTool: McpToolAdapterDefinition = {
  name: 'create_segment',
  adapterName: 'createSegment',
  description: 'Create a new segment',
  inputSchema: z.object({ name: z.string(), description: z.string() }),
  operationType: 'write'
};

export default createSegmentTool;
