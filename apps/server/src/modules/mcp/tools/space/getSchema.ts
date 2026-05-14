import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const getSchemaTool: McpToolAdapterDefinition = {
  name: 'get_schema',
  adapterName: 'getSchema',
  description: 'Get the full element tree for a space and environment',
  inputSchema: z.object({}),
  operationType: 'read'
};

export default getSchemaTool;
