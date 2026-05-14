import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const deletePageTool: McpToolAdapterDefinition = {
  name: 'delete_page',
  adapterName: 'deletePage',
  description: 'Delete a page by ID',
  inputSchema: z.object({ pageId: z.string() }),
  operationType: 'write'
};

export default deletePageTool;
