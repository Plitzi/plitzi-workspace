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
      type: variableTypesSchema.describe('Variable type'),
      value: z.string().describe('Variable default value'),
      category: z.string().describe('Variable category')
    })
    .describe('Variable to create')
});

const createSegmentVariableTool: McpTool = {
  name: 'create_segment_variable',
  adapterName: 'createSegmentVariable',
  mcpDefinition: {
    title: 'Create Segment Variable',
    description:
      'Create a schema variable inside a segment.\n\n' +
      '━━ REQUIRED INPUT ━━\n' +
      'segmentId: ID of the segment\n' +
      'variable.name: Variable name\n' +
      'variable.type: Variable type (text | number | email | password | select | select2 | checkbox | textarea | color | switch)\n' +
      'variable.value: Default value\n' +
      'variable.category: Category to group the variable',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default createSegmentVariableTool;
