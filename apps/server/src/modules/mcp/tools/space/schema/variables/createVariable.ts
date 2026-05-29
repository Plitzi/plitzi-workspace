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
  variable: z
    .object({
      name: z.string().describe('Variable name'),
      type: variableTypesSchema.describe('Variable type'),
      value: z.string().describe('Variable default value'),
      category: z.string().describe('Grouping label shown in the builder UI (e.g. "Colors", "Typography", "Layout")')
    })
    .describe('Variable to create')
});

const outputSchema = z.object({
  data: z
    .object({
      name: z.string().describe('Variable name'),
      type: z.string().describe('Variable type'),
      value: z.string().describe('Variable value'),
      category: z.string().describe('Grouping label shown in the builder UI (e.g. "Colors", "Typography", "Layout")')
    })
    .describe('The created variable')
});

const createVariableTool: McpTool = {
  name: 'create_variable',
  adapterName: 'createSchemaVariable',
  mcpDefinition: {
    title: 'Create Variable',
    description:
      'Create a space-level schema variable — a typed, named value that elements can reference via data bindings.\n\n' +
      'Use category to group related variables in the builder UI (e.g. "Colors", "Typography"). ' +
      'All values are stored as strings regardless of type.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default createVariableTool;
