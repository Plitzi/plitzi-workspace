import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const listElementsTool: McpToolAdapterDefinition = {
  name: 'list_elements',
  adapterName: 'listElements',
  description: 'List all element IDs, types and labels for a space and environment',
  inputSchema: z.object({}),
  operationType: 'read'
};

export default listElementsTool;
