import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const variableTypesSchema = z.enum([
  'text',
  'number',
  'email',
  'password',
  'select',
  'select2',
  'checkbox',
  'textarea',
  'color',
  'switch'
]);

const createSegmentVariableTool: McpToolAdapterDefinition = {
  name: 'create_segment_variable',
  adapterName: 'createSegmentVariable',
  description: 'Create a segment schema variable',
  inputSchema: z.object({
    segmentId: z.string(),
    variable: z.object({ name: z.string(), type: variableTypesSchema, value: z.string(), category: z.string() })
  }),
  operationType: 'write'
};

export default createSegmentVariableTool;
