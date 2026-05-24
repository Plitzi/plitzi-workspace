import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  elementId: z.string().describe('ID of the element to move'),
  toParentId: z.string().describe('ID of the new parent element'),
  dropPosition: z
    .enum(['top', 'bottom', 'left', 'right', 'inside', 'custom'])
    .optional()
    .describe('Position within the new parent')
});

const outputSchema = z.object({
  data: z.literal(true).describe('Always true on successful move')
});

const moveElementTool: McpTool = {
  name: 'move_element',
  adapterName: 'moveElement',
  mcpDefinition: {
    title: 'Move Element',
    description: 'Move an element to a different parent or position.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default moveElementTool;
