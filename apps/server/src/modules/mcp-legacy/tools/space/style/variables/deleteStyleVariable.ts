import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  category: z.nativeEnum(StyleVariableCategory).describe('Token category: "color", "spacing", "shadow", or "custom"'),
  name: z.string().describe('Variable name to delete')
});

const outputSchema = z.literal(true).describe('Always true on successful deletion');

const deleteStyleVariableTool: McpTool = {
  name: 'delete_style_variable',
  adapterName: 'deleteStyleVariable',
  mcpDefinition: {
    title: 'Delete Style Variable',
    description: 'Delete a global CSS design token. Any style rules referencing this token will lose its value.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default deleteStyleVariableTool;
