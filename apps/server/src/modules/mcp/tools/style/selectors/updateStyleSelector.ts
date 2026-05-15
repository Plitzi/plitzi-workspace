import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const displayModes = z.enum(['desktop', 'tablet', 'mobile']);
const tagTypes = z.enum(['class', 'element', 'id']);

const inputSchema = z.object({
  displayMode: displayModes.describe('Display mode (desktop, tablet, mobile)'),
  selector: z.string().describe('CSS selector'),
  type: tagTypes.describe('Selector type (class, element, id)'),
  path: z.string().optional().describe('Optional path filter'),
  style: z.record(z.string(), z.record(z.string(), z.unknown())).optional().describe('Style properties'),
  params: z.record(z.string(), z.unknown()).optional().describe('Additional parameters')
});

const updateStyleSelectorTool: McpTool = {
  name: 'update_style_selector',
  adapterName: 'updateStyleSelector',
  mcpDefinition: {
    title: 'Update Style Selector',
    description: 'Update a global style selector',
    inputSchema
  },
  definition: {
    shortDescription: 'Update a global style selector',
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default updateStyleSelectorTool;
