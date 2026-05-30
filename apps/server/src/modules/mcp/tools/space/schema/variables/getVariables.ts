import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';
import { schemaVariableSchema } from '../schemas';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

const outputSchema = z.array(schemaVariableSchema).describe('All schema variables in the space');

const getVariablesTool: McpTool = {
  name: 'get_variables',
  adapterName: 'getVariables',
  mcpDefinition: {
    title: 'Get Variables',
    description:
      'List all schema variables in the space.\n\n' +
      'Schema variables are space-level typed values (text, color, number, etc.) that elements can reference via data bindings. ' +
      'Use get_variable to retrieve a single variable by name.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default getVariablesTool;
