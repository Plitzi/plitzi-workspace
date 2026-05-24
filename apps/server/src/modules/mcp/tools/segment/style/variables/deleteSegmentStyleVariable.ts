import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  segmentId: z.string().describe('ID of the segment'),
  category: z.nativeEnum(StyleVariableCategory).describe('Variable category'),
  name: z.string().describe('Variable name to delete')
});

const outputSchema = z.object({
  data: z.literal(true).describe('Always true on successful deletion')
});

const deleteSegmentStyleVariableTool: McpTool = {
  name: 'delete_segment_style_variable',
  adapterName: 'deleteSegmentStyleVariable',
  mcpDefinition: {
    title: 'Delete Segment Style Variable',
    description: 'Delete a style variable from a segment.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default deleteSegmentStyleVariableTool;
