import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import { createTool, callAdapter } from '../../../utils';

const createSegmentStyleVariableTool = createTool<'createSegmentStyleVariable'>(
  'create_segment_style_variable',
  'Create a segment style variable',
  z.object({
    segmentId: z.string(),
    category: z.nativeEnum(StyleVariableCategory),
    name: z.string(),
    value: z.union([z.string(), z.number(), z.record(z.string(), z.unknown())])
  }),
  'write',
  (args, adapters, ctx) => callAdapter('createSegmentStyleVariable', args, adapters, ctx)
);

export default createSegmentStyleVariableTool;
