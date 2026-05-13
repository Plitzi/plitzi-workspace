import { z } from 'zod';

import { createTool, callAdapter } from '../../utils';

const createElementTool = createTool<'createElement'>(
  'create_element',
  'Add a new element to the schema. Returns the created element with its generated ID.',
  z.object({
    element: z.object({
      type: z.string().describe('Component type (e.g. Container, Text, Button, Image)'),
      label: z.string().describe('Human-readable name for the element'),
      props: z.record(z.string(), z.unknown()).optional().describe('Component props/attributes'),
      runtime: z.enum(['server', 'client', 'shared']).optional().describe('Rendering runtime')
    }),
    parentId: z.string().optional().describe('Parent element ID; omit to place at root'),
    position: z.number().optional().describe('Zero-based insertion index within the parent')
  }),
  'write',
  (args, adapters, ctx) => callAdapter('createElement', args, adapters, ctx)
);

export default createElementTool;
