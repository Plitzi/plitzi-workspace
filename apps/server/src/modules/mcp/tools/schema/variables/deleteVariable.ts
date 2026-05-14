import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const deleteVariableTool: McpToolAdapterDefinition = {
  name: 'delete_variable',
  adapterName: 'deleteVariable',
  description: 'Delete a schema variable',
  inputSchema: z.object({ name: z.string() }),
  operationType: 'write'
};

export default deleteVariableTool;
