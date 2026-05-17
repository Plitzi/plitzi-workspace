import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import { getAllowedModes, zodToJsonSchema } from '../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  category: z.nativeEnum(StyleVariableCategory).describe('Variable category'),
  name: z.string().describe('Variable name to delete')
});

const deleteStyleVariableTool: McpTool = {
  name: 'delete_style_variable',
  adapterName: 'deleteStyleVariable',
  mcpDefinition: {
    title: 'Delete Style Variable',
    description:
      'Delete a global style variable.\n\n' +
      '━━ REQUIRED INPUT ━━\n' +
      'category: Category of the variable (color | spacing | typography | sizing | misc)\n' +
      'name: Name of the variable to delete\n\n' +
      '━━ WARNING ━━\n' +
      'This removes the variable from all elements using it.',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default deleteStyleVariableTool;
