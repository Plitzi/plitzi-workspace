import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const deleteElementTool: McpToolAdapterDefinition = {
  name: 'delete_element',
  adapterName: 'deleteElement',
  description: 'Remove an element and all its descendants from the schema',
  inputSchema: z.object({ elementId: z.string() }),
  operationType: 'write'
};

export default deleteElementTool;
