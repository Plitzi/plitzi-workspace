import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const elementSchema = z.object({
  id: z.string().describe('Element ID'),
  attributes: z.record(z.string(), z.unknown()).describe('Element attributes'),
  definition: z
    .object({
      rootId: z.string().describe('Root element ID'),
      label: z.string().describe('Element label'),
      type: z.string().describe('Element type'),
      parentId: z.string().optional().describe('Parent element ID'),
      items: z.array(z.string()).optional().describe('Child element IDs'),
      styleSelectors: z.record(z.string(), z.string()).describe('Style selector map'),
      runtime: z.enum(['server', 'client', 'shared']).optional().describe('Rendering runtime'),
      loadStrategy: z.enum(['eager', 'lazy', 'visible']).optional().describe('Load strategy')
    })
    .describe('Element definition')
});

const inputSchema = z.object({
  elementId: z.string().describe('ID of the element to update'),
  updates: z
    .object({
      label: z.string().optional().describe('New label for the element'),
      props: z.record(z.string(), z.unknown()).optional().describe('New props for the element'),
      styles: z.record(z.string(), z.unknown()).optional().describe('Style attribute overrides keyed by sub-selector slot (e.g. { base: { color: "#fff" } }). Rarely needed — prefer update_style_selector to modify styles.'),
      runtime: z.enum(['server', 'client', 'shared']).optional().describe('New rendering runtime')
    })
    .describe('Fields to update')
});

const outputSchema = z.object({
  data: elementSchema.describe('The updated element')
});

const updateElementTool: McpTool = {
  name: 'update_element',
  adapterName: 'updateElement',
  mcpDefinition: {
    title: 'Update Element',
    description: 'Update an existing element — label, props, or rendering runtime.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default updateElementTool;
