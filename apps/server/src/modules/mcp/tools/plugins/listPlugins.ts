import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const listPluginsTool: McpToolAdapterDefinition = {
  name: 'list_plugins',
  adapterName: 'listPlugins',
  description: 'List all plugins registered in the system',
  inputSchema: z.object({}),
  operationType: 'read'
};

export default listPluginsTool;
