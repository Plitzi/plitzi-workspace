import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const listSpacesTool: McpToolAdapterDefinition = {
  name: 'list_spaces',
  adapterName: 'listSpaces',
  description: 'List all spaces available in the user',
  inputSchema: z.object({}),
  operationType: 'read'
};

export default listSpacesTool;
