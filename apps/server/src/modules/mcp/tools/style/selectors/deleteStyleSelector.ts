import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const displayModes = z.enum(['desktop', 'tablet', 'mobile']);

const inputSchema = z.object({
  displayMode: displayModes.describe('Display mode (desktop, tablet, mobile)'),
  selector: z.string().describe('CSS selector to delete')
});

const deleteStyleSelectorTool: McpTool = {
  name: 'delete_style_selector',
  adapterName: 'deleteStyleSelector',
  mcpDefinition: {
    title: 'Delete Style Selector',
    description: 'Delete a global CSS style selector.',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default deleteStyleSelectorTool;
