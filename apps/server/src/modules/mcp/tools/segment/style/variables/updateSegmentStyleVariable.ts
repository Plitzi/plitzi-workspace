import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import { getAllowedModes, zodToJsonSchema } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  segmentId: z.string().describe('ID of the segment'),
  category: z.nativeEnum(StyleVariableCategory).describe('Variable category'),
  name: z.string().describe('Variable name'),
  value: z.union([z.string(), z.number(), z.record(z.string(), z.unknown())]).describe('Variable value')
});

const updateSegmentStyleVariableTool: McpTool = {
  name: 'update_segment_style_variable',
  adapterName: 'updateSegmentStyleVariable',
  mcpDefinition: {
    title: 'Update Segment Style Variable',
    description: 'Update a segment style variable',
    inputSchema
  },
  definition: {
    shortDescription: 'Update a segment style variable',
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default updateSegmentStyleVariableTool;
