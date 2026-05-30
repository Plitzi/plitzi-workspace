import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const compactElementSchema = z.object({
  id: z.string().describe('Element ID'),
  label: z.string().describe('Element label'),
  type: z.string().describe('Element type'),
  parentId: z.string().optional().describe('Parent element ID'),
  items: z.array(z.string()).optional().describe('Child element IDs')
});

const inputSchema = z.object({
  elementId: z.string().describe('ID of the element to clone'),
  to: z.string().describe('Target element ID — where to place the clone'),
  dropPosition: z
    .enum(['inside', 'top', 'bottom', 'left', 'right', 'custom'])
    .describe('Position relative to the target: inside as a child, top/bottom as a sibling')
});

const outputSchema = z
  .array(compactElementSchema)
  .nullable()
  .describe('Cloned elements as compact summaries, or null on failure');

const cloneElementTool: McpTool = {
  name: 'clone_element',
  adapterName: 'cloneElement',
  mcpDefinition: {
    title: 'Clone Element',
    description:
      'Duplicate an element and all its children to a new location in the schema.\n\n' +
      'The server fetches the element and its full subtree automatically — just provide the elementId. ' +
      'Use get_element or list_elements first to find the element ID.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default cloneElementTool;
