import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const moveElementTool: McpToolAdapterDefinition = {
  name: 'move_element',
  adapterName: 'moveElement',
  description: 'Move an element to a different parent',
  inputSchema: z.object({
    elementId: z.string(),
    toParentId: z.string(),
    dropPosition: z.enum(['top', 'bottom', 'left', 'right', 'inside', 'custom']).optional()
  }),
  operationType: 'write'
};

export default moveElementTool;
