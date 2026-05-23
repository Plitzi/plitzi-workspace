import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../../helpers';

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

const outputSchema = z.object({
  data: z
    .object({
      displayMode: z.string().describe('Display mode'),
      selector: z.string().describe('CSS selector'),
      type: z.string().describe('Selector type')
    })
    .catchall(z.unknown())
    .describe('The created style selector')
});

const createStyleSelectorTool: McpTool = {
  name: 'create_style_selector',
  adapterName: 'createStyleSelector',
  mcpDefinition: {
    title: 'Create Style Selector',
    description: 'Create a global CSS style selector.',
    inputSchema,
    outputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default createStyleSelectorTool;
