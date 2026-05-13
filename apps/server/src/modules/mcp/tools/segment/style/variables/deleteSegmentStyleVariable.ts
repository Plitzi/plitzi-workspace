import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import { createTool, callAdapter } from '../../../utils';

const deleteSegmentStyleVariableTool = createTool<'deleteSegmentStyleVariable'>(
  'delete_segment_style_variable',
  'Delete a segment style variable',
  z.object({ segmentId: z.string(), category: z.nativeEnum(StyleVariableCategory), name: z.string() }),
  'write',
  (args, adapters, ctx) => callAdapter('deleteSegmentStyleVariable', args, adapters, ctx)
);

export default deleteSegmentStyleVariableTool;
