import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const createSegmentStyleVariableTool: McpToolAdapterDefinition = {
  name: 'create_segment_style_variable',
  adapterName: 'createSegmentStyleVariable',
  description: 'Create a segment style variable',
  inputSchema: z.object({
    segmentId: z.string(),
    category: z.nativeEnum(StyleVariableCategory),
    name: z.string(),
    value: z.union([z.string(), z.number(), z.record(z.string(), z.unknown())])
  }),
  operationType: 'write'
};

export default createSegmentStyleVariableTool;
