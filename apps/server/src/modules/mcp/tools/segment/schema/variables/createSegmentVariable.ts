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

const createSegmentVariableTool = createTool<'createSegmentVariable'>(
  'create_segment_variable',
  'Create a segment schema variable',
  z.object({
    segmentId: z.string(),
    variable: z.object({ name: z.string(), type: variableTypesSchema, value: z.string(), category: z.string() })
  }),
  'write',
  (args, adapters, ctx) => callAdapter('createSegmentVariable', args, adapters, ctx)
);

export default createSegmentVariableTool;
