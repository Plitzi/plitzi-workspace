import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  segmentId: z.string().describe('ID of the segment'),
  category: z.nativeEnum(StyleVariableCategory).describe('Variable category'),
  name: z.string().describe('Variable name'),
  value: z.union([z.string(), z.number(), z.record(z.string(), z.unknown())]).describe('Variable value')
});

const outputSchema = z.object({
  data: z
    .object({
      category: z.string().describe('Variable category'),
      name: z.string().describe('Variable name'),
      value: z.union([z.string(), z.number(), z.record(z.string(), z.string())]).describe('Variable value')
    })
    .describe('The created segment style variable')
});

const createSegmentStyleVariableTool: McpTool = {
  name: 'create_segment_style_variable',
  adapterName: 'createSegmentStyleVariable',
  mcpDefinition: {
    title: 'Create Segment Style Variable',
    description: 'Create a style variable inside a segment.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default createSegmentStyleVariableTool;
