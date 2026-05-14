import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const updateStyleVariableTool: McpToolAdapterDefinition = {
  name: 'update_style_variable',
  adapterName: 'updateStyleVariable',
  description: 'Update a global style variable',
  inputSchema: z.object({
    category: z.nativeEnum(StyleVariableCategory),
    name: z.string(),
    value: z.union([z.string(), z.number(), z.record(z.string(), z.unknown())])
  }),
  operationType: 'write'
};

export default updateStyleVariableTool;
