import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const displayModes = z.enum(['desktop', 'tablet', 'mobile']);

const inputSchema = z.object({
  displayMode: displayModes.describe('Responsive breakpoint to delete this selector from'),
  selector: z.string().describe('CSS selector string to remove (e.g. ".hero-banner")')
});

const outputSchema = z.literal(true).describe('Always true on successful deletion');

const deleteStyleSelectorTool: McpTool = {
  name: 'delete_style_selector',
  adapterName: 'deleteStyleSelector',
  mcpDefinition: {
    title: 'Delete Style Selector',
    description:
      'Delete a CSS selector from the space style for the specified display mode. Only removes from that mode — other breakpoints are unaffected.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default deleteStyleSelectorTool;
