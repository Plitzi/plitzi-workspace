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
    description:
      'Delete a global CSS style selector.\n\n' +
      '━━ REQUIRED INPUT ━━\n' +
      'displayMode: Display mode (desktop | tablet | mobile)\n' +
      'selector: CSS selector to delete\n\n' +
      '━━ WARNING ━━\n' +
      'This removes the selector from all elements using it.',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default deleteStyleSelectorTool;
