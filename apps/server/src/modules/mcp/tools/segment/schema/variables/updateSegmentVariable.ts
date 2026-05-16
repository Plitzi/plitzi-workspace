import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

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

const inputSchema = z.object({
  segmentId: z.string().describe('ID of the segment'),
  variable: z
    .object({
      name: z.string().describe('Variable name'),
      type: variableTypesSchema.optional().describe('Variable type'),
      value: z.string().optional().describe('Variable value'),
      category: z.string().optional().describe('Variable category')
    })
    .describe('Variable fields to update')
});

const updateSegmentVariableTool: McpTool = {
  name: 'update_segment_variable',
  adapterName: 'updateSegmentVariable',
  mcpDefinition: {
    title: 'Update Segment Variable',
    description: 'Update a segment schema variable',
    inputSchema
  },
  definition: {
    shortDescription: 'Update a segment schema variable',
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default updateSegmentVariableTool;
