import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import { getAllowedModes, zodToJsonSchema } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
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
    .describe('The created style variable')
});

const createStyleVariableTool: McpTool = {
  name: 'create_style_variable',
  adapterName: 'createStyleVariable',
  mcpDefinition: {
    title: 'Create Style Variable',
    description: 'Create a global CSS style variable (custom property).',
    inputSchema,
    outputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default createStyleVariableTool;
