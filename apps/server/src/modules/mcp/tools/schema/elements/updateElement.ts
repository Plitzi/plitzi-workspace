import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const updateElementTool: McpToolAdapterDefinition = {
  name: 'update_element',
  adapterName: 'updateElement',
  description: 'Update an existing element — label, props, styles, or runtime',
  inputSchema: z.object({
    elementId: z.string(),
    updates: z.object({
      label: z.string().optional(),
      props: z.record(z.string(), z.unknown()).optional(),
      styles: z.record(z.string(), z.unknown()).optional(),
      runtime: z.enum(['server', 'client', 'shared']).optional()
    })
  }),
  operationType: 'write'
};

export default updateElementTool;
