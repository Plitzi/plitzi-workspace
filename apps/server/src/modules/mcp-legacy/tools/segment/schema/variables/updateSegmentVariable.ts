import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';

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
      category: z.string().optional().describe('Grouping label shown in the builder UI')
    })
    .describe('Variable fields to update')
});

const outputSchema = z
  .object({
    name: z.string().describe('Variable name'),
    type: z.string().describe('Variable type'),
    value: z.string().describe('Variable value'),
    category: z.string().describe('Grouping label shown in the builder UI')
  })
  .describe('The updated segment variable');

const updateSegmentVariableTool: McpTool = {
  name: 'update_segment_variable',
  adapterName: 'updateSegmentVariable',
  mcpDefinition: {
    title: 'Update Segment Variable',
    description:
      'Update an existing schema variable inside a segment. Identified by name; only the provided fields are changed.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default updateSegmentVariableTool;
