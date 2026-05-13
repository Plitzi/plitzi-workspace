import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import { createTool, callAdapter } from '../../../utils';

const updateSegmentStyleVariableTool = createTool<'updateSegmentStyleVariable'>(
  'update_segment_style_variable',
  'Update a segment style variable',
  z.object({
    segmentId: z.string(),
    category: z.nativeEnum(StyleVariableCategory),
    name: z.string(),
    value: z.union([z.string(), z.number(), z.record(z.string(), z.unknown())])
  }),
  'write',
  (args, adapters, ctx) => callAdapter('updateSegmentStyleVariable', args, adapters, ctx)
);

export default updateSegmentStyleVariableTool;
