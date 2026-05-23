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

const outputSchema = z.object({
  data: z
    .object({
      name: z.string().describe('Variable name'),
      type: z.string().describe('Variable type'),
      value: z.string().describe('Variable value'),
      category: z.string().describe('Variable category')
    })
    .describe('The updated segment variable')
});

const updateSegmentVariableTool: McpTool = {
  name: 'update_segment_variable',
  adapterName: 'updateSegmentVariable',
  mcpDefinition: {
    title: 'Update Segment Variable',
    description: 'Update a schema variable inside a segment.',
    inputSchema,
    outputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default updateSegmentVariableTool;
