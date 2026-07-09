import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  segmentId: z.string().describe('ID of the segment'),
  category: z.nativeEnum(StyleVariableCategory).describe('Token category: "color", "spacing", "shadow", or "custom"'),
  name: z.string().describe('Token name to delete')
});

const outputSchema = z.literal(true).describe('Always true on successful deletion');

const deleteSegmentStyleVariableTool: McpTool = {
  name: 'delete_segment_style_variable',
  adapterName: 'deleteSegmentStyleVariable',
  mcpDefinition: {
    title: 'Delete Segment Style Variable',
    description:
      'Delete a scoped CSS design token from a segment. Any style rules inside the segment referencing this token will lose its value.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default deleteSegmentStyleVariableTool;
