import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import { getAllowedModes, zodToJsonSchema } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  segmentId: z.string().describe('ID of the segment'),
  category: z.nativeEnum(StyleVariableCategory).describe('Variable category'),
  name: z.string().describe('Variable name to delete')
});

const deleteSegmentStyleVariableTool: McpTool = {
  name: 'delete_segment_style_variable',
  adapterName: 'deleteSegmentStyleVariable',
  mcpDefinition: {
    title: 'Delete Segment Style Variable',
    description:
      'Delete a style variable from a segment.\n\n' +
      '━━ REQUIRED INPUT ━━\n' +
      'segmentId: ID of the segment\n' +
      'category: Variable category\n' +
      'name: Variable name to delete',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default deleteSegmentStyleVariableTool;
