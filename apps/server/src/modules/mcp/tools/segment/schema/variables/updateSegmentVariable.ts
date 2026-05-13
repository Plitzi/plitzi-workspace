import { z } from 'zod';

import { createTool, callAdapter } from '../../../utils';

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

const updateSegmentVariableTool = createTool<'updateSegmentVariable'>(
  'update_segment_variable',
  'Update a segment schema variable',
  z.object({
    segmentId: z.string(),
    variable: z.object({
      name: z.string(),
      type: variableTypesSchema.optional(),
      value: z.string().optional(),
      category: z.string().optional()
    })
  }),
  'write',
  (args, adapters, ctx) => callAdapter('updateSegmentVariable', args, adapters, ctx)
);

export default updateSegmentVariableTool;
