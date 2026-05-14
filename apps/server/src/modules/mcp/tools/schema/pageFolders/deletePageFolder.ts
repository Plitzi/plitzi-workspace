import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const deletePageFolderTool: McpToolAdapterDefinition = {
  name: 'delete_page_folder',
  adapterName: 'deletePageFolder',
  description: 'Delete a page folder',
  inputSchema: z.object({ id: z.string() }),
  operationType: 'write'
};

export default deletePageFolderTool;
