import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';
import { schemaVariableSchema } from '../schemas';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  name: z.string().describe('Name of the variable to retrieve')
});

const outputSchema = schemaVariableSchema.nullable().describe('The variable, or null if not found');

const getVariableTool: McpTool = {
  name: 'get_variable',
  adapterName: 'getVariable',
  mcpDefinition: {
    title: 'Get Variable',
    description:
      'Get a specific schema variable by name.\n\n' +
      'Schema variables are space-level typed values that elements can reference via data bindings. ' +
      'Use get_variables to list all available variable names first if needed.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default getVariableTool;
