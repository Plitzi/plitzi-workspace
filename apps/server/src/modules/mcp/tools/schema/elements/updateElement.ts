import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  elementId: z.string().describe('ID of the element to update'),
  updates: z
    .object({
      label: z.string().optional().describe('New label for the element'),
      props: z.record(z.string(), z.unknown()).optional().describe('New props for the element'),
      styles: z.record(z.string(), z.unknown()).optional().describe('New styles for the element'),
      runtime: z.enum(['server', 'client', 'shared']).optional().describe('New rendering runtime')
    })
    .describe('Fields to update')
});

const updateElementTool: McpTool = {
  name: 'update_element',
  adapterName: 'updateElement',
  mcpDefinition: {
    title: 'Update Element',
    description: 'Update an existing element: label, props, styles, or runtime.',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default updateElementTool;
