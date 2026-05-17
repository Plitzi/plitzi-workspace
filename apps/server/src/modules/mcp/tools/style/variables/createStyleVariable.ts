import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import { getAllowedModes, zodToJsonSchema } from '../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  category: z.nativeEnum(StyleVariableCategory).describe('Variable category'),
  name: z.string().describe('Variable name'),
  value: z.union([z.string(), z.number(), z.record(z.string(), z.unknown())]).describe('Variable value')
});

const createStyleVariableTool: McpTool = {
  name: 'create_style_variable',
  adapterName: 'createStyleVariable',
  mcpDefinition: {
    title: 'Create Style Variable',
    description:
      'Create a global style variable (CSS custom property).\n\n' +
      '━━ REQUIRED INPUT ━━\n' +
      'category: Variable category (color | spacing | typography | sizing | misc)\n' +
      'name: Variable name (e.g. "primary", "spacing-md", "font-base")\n' +
      'value: Variable value (hex color, px value, font name, etc.)',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default createStyleVariableTool;
