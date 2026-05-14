import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const updatePageFolderTool: McpToolAdapterDefinition = {
  name: 'update_page_folder',
  adapterName: 'updatePageFolder',
  description: 'Update a page folder',
  inputSchema: z.object({
    id: z.string(),
    updates: z.object({ name: z.string().optional(), slug: z.string().optional(), parentId: z.string().optional() })
  }),
  operationType: 'write'
};

export default updatePageFolderTool;
