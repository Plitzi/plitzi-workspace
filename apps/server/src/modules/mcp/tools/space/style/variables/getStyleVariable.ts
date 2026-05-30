import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  category: z.string().describe('Variable category (e.g. "colors", "typography")'),
  name: z.string().describe('Variable name within the category (e.g. "--primary-500")')
});

const outputSchema = z
  .unknown()
  .describe('The variable value — a string, number, or theme-aware object with light/dark/default keys');

const getStyleVariableTool: McpTool = {
  name: 'get_style_variable',
  adapterName: 'getStyleVariable',
  mcpDefinition: {
    title: 'Get Style Variable',
    description:
      'Get a single CSS custom property variable by category and name.\n\n' +
      'Use get_style_variables to list all available categories and names first.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default getStyleVariableTool;
