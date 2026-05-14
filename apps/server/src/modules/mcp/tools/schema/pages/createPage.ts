import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const createPageTool: McpToolAdapterDefinition = {
  name: 'create_page',
  adapterName: 'createPage',
  description: 'Create a new page in the space',
  inputSchema: z.object({ name: z.string() }),
  operationType: 'write'
};

export default createPageTool;
