import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const getElementTool: McpToolAdapterDefinition = {
  name: 'get_element',
  adapterName: 'getElement',
  description: 'Get the full details of a single element by ID',
  inputSchema: z.object({ elementId: z.string().describe('Element ID') }),
  operationType: 'read'
};

export default getElementTool;
