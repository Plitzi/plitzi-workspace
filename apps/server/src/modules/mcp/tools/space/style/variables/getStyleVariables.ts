import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

const outputSchema = z
  .record(z.string(), z.record(z.string(), z.unknown()))
  .describe('CSS custom properties grouped by category. Each category maps variable names to their values.');

const getStyleVariablesTool: McpTool = {
  name: 'get_style_variables',
  adapterName: 'getStyleVariables',
  mcpDefinition: {
    title: 'Get Style Variables',
    description:
      'List all CSS custom property variables in the space style, grouped by category.\n\n' +
      'Variables are organized as { category: { variableName: value } }. ' +
      'Values may be simple strings or theme-aware objects with light/dark/default variants. ' +
      'Use get_style_variable to retrieve a single variable by category and name.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default getStyleVariablesTool;
