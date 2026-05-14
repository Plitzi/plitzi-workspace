import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const createPageFolderTool: McpToolAdapterDefinition = {
  name: 'create_page_folder',
  adapterName: 'createPageFolder',
  description: 'Create a new page folder',
  inputSchema: z.object({ name: z.string(), parentId: z.string().optional() }),
  operationType: 'write'
};

export default createPageFolderTool;
