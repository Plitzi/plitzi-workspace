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

const updateSegmentVariableTool: McpToolAdapterDefinition = {
  name: 'update_segment_variable',
  adapterName: 'updateSegmentVariable',
  description: 'Update a segment schema variable',
  inputSchema: z.object({
    segmentId: z.string(),
    variable: z.object({
      name: z.string(),
      type: variableTypesSchema.optional(),
      value: z.string().optional(),
      category: z.string().optional()
    })
  }),
  operationType: 'write'
};

export default updateSegmentVariableTool;
