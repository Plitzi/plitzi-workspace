import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const createElementTool: McpToolAdapterDefinition = {
  name: 'create_element',
  adapterName: 'createElement',
  description: 'Add a new element to the schema. Returns the created element with its generated ID.',
  inputSchema: z.object({
    element: z.object({
      type: z.string().describe('Component type (e.g. Container, Text, Button, Image)'),
      label: z.string().describe('Human-readable name for the element'),
      props: z.record(z.string(), z.unknown()).optional().describe('Component props/attributes'),
      runtime: z.enum(['server', 'client', 'shared']).optional().describe('Rendering runtime')
    }),
    parentId: z.string().optional().describe('Parent element ID; omit to place at root'),
    position: z.number().optional().describe('Zero-based insertion index within the parent')
  }),
  operationType: 'write'
};

export default createElementTool;
