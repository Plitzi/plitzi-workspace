import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  element: z
    .object({
      type: z.string().describe('Component type (e.g. Container, Text, Button, Image)'),
      label: z.string().describe('Human-readable name for the element'),
      props: z.record(z.string(), z.unknown()).optional().describe('Component props/attributes'),
      runtime: z.enum(['server', 'client', 'shared']).optional().describe('Rendering runtime')
    })
    .describe('Element to create'),
  parentId: z.string().optional().describe('Parent element ID; omit to place at root'),
  position: z.number().optional().describe('Zero-based insertion index within the parent')
});

const createElementTool: McpTool = {
  name: 'create_element',
  adapterName: 'createElement',
  mcpDefinition: {
    title: 'Create Element',
    description:
      'Add a new element to the schema.\n\n' +
      '━━ REQUIRED INPUT ━━\n' +
      'element.type: Component type (e.g. Container, Text, Button, Image)\n' +
      'element.label: Human-readable name for the element\n\n' +
      '━━ OPTIONAL INPUT ━━\n' +
      'parentId: Parent element ID; omit to place at root\n' +
      'position: Zero-based insertion index within the parent\n\n' +
      '━━ OUTPUT ━━\n' +
      'Returns the created element with its generated ID.',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default createElementTool;
