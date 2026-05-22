import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import { getAllowedModes, zodToJsonSchema } from '../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  category: z.nativeEnum(StyleVariableCategory).describe('Variable category'),
  name: z.string().describe('Variable name'),
  value: z.union([z.string(), z.number(), z.record(z.string(), z.unknown())]).describe('Variable value')
});

const updateStyleVariableTool: McpTool = {
  name: 'update_style_variable',
  adapterName: 'updateStyleVariable',
  mcpDefinition: {
    title: 'Update Style Variable',
    description: 'Update an existing global style variable.',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default updateStyleVariableTool;
