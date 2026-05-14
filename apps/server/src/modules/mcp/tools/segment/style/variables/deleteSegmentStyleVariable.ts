import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const deleteSegmentStyleVariableTool: McpToolAdapterDefinition = {
  name: 'delete_segment_style_variable',
  adapterName: 'deleteSegmentStyleVariable',
  description: 'Delete a segment style variable',
  inputSchema: z.object({ segmentId: z.string(), category: z.nativeEnum(StyleVariableCategory), name: z.string() }),
  operationType: 'write'
};

export default deleteSegmentStyleVariableTool;
