import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  name: z.string().describe('Name of the variable to delete')
});

const deleteVariableTool: McpTool = {
  name: 'delete_variable',
  adapterName: 'deleteVariable',
  mcpDefinition: {
    title: 'Delete Variable',
    description:
      'Delete a schema variable.\n\n' +
      '━━ REQUIRED INPUT ━━\n' +
      'name: Name of the variable to delete\n\n' +
      '━━ WARNING ━━\n' +
      'This permanently removes the variable. Any elements using it will lose the reference.',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default deleteVariableTool;
