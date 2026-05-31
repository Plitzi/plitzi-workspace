import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  name: z.string().describe('Name of the variable to delete')
});

const outputSchema = z.literal(true).describe('Always true on successful deletion');

const deleteVariableTool: McpTool = {
  name: 'delete_variable',
  adapterName: 'deleteSchemaVariable',
  mcpDefinition: {
    title: 'Delete Variable',
    description: 'Delete a schema variable. Any element bindings referencing this variable will break.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default deleteVariableTool;
