import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  displayMode: z
    .enum(['desktop', 'tablet', 'mobile'])
    .optional()
    .describe('Filter to a specific display mode. Omit to get selectors across all modes.')
});

const outputSchema = z
  .record(z.string(), z.array(z.string()))
  .describe('Selector names grouped by display mode (e.g. { desktop: [".hero", "#nav"] })');

const getStyleSelectorsTool: McpTool = {
  name: 'get_style_selectors',
  adapterName: 'getStyleSelectors',
  mcpDefinition: {
    title: 'Get Style Selectors',
    description:
      'List the names of all CSS selectors defined in the space style, grouped by display mode.\n\n' +
      'Returns only selector names (e.g. ".hero-section", "#nav", "button") — not the full style data. ' +
      'Use displayMode to filter to a single mode. ' +
      'Use create_style_selector or update_style_selector to modify a selector.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default getStyleSelectorsTool;
