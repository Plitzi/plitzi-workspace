import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  category: z
    .nativeEnum(StyleVariableCategory)
    .describe(
      'Token category: "color" for hex/rgba values, "spacing" for size/spacing units, "shadow" for box-shadow values, "custom" for any other CSS property'
    ),
  name: z.string().describe('Token name to update'),
  value: z
    .union([z.string(), z.number(), z.record(z.string(), z.unknown())])
    .describe(
      'New token value. Use a plain string/number for a fixed value, or { light: "...", dark: "...", default: "..." } for theme-aware values'
    )
});

const outputSchema = z
  .object({
    category: z.string().describe('Variable category'),
    name: z.string().describe('Variable name'),
    value: z.union([z.string(), z.number(), z.record(z.string(), z.string())]).describe('Variable value')
  })
  .describe('The updated style variable');

const updateStyleVariableTool: McpTool = {
  name: 'update_style_variable',
  adapterName: 'updateStyleVariable',
  mcpDefinition: {
    title: 'Update Style Variable',
    description: 'Update an existing global CSS design token (color, spacing, shadow, or custom).',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default updateStyleVariableTool;
