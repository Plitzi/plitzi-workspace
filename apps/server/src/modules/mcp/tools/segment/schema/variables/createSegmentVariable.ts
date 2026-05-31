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
      type: variableTypesSchema.describe('Variable type'),
      value: z.string().describe('Variable default value'),
      category: z.string().describe('Grouping label shown in the builder UI (e.g. "Colors", "Layout")')
    })
    .describe('Variable to create')
});

const outputSchema = z
  .object({
    name: z.string().describe('Variable name'),
    type: z.string().describe('Variable type'),
    value: z.string().describe('Variable value'),
    category: z.string().describe('Grouping label shown in the builder UI (e.g. "Colors", "Layout")')
  })
  .describe('The created segment variable');

const createSegmentVariableTool: McpTool = {
  name: 'create_segment_variable',
  adapterName: 'createSegmentVariable',
  mcpDefinition: {
    title: 'Create Segment Variable',
    description:
      'Create a schema variable inside a segment — a typed, named value that segment elements can reference via data bindings.\n\n' +
      'All values are stored as strings regardless of type.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default createSegmentVariableTool;
