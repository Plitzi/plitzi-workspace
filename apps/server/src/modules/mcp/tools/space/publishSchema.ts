import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const publishSchemaTool: McpToolAdapterDefinition = {
  name: 'publish_schema',
  adapterName: 'publishSchema',
  description: 'Publish the current draft schema as a new immutable revision',
  inputSchema: z.object({}),
  operationType: 'admin'
};

export default publishSchemaTool;
