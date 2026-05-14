import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const deleteStyleVariableTool: McpToolAdapterDefinition = {
  name: 'delete_style_variable',
  adapterName: 'deleteStyleVariable',
  description: 'Delete a global style variable',
  inputSchema: z.object({ category: z.nativeEnum(StyleVariableCategory), name: z.string() }),
  operationType: 'write'
};

export default deleteStyleVariableTool;
