import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const displayModes = z.enum(['desktop', 'tablet', 'mobile']);
const tagTypes = z.enum(['class', 'element', 'id']);

const inputSchema = z.object({
  displayMode: displayModes.describe('Responsive breakpoint this selector applies to'),
  selector: z.string().describe('CSS selector string (e.g. ".hero-banner", "button", "#nav")'),
  type: tagTypes.describe('Selector kind: "class" for .className, "element" for HTML tag, "id" for #id'),
  path: z.string().optional().describe('Internal scope path — omit in most cases'),
  style: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .optional()
    .describe('Initial CSS rules keyed by sub-selector slot (e.g. { base: { backgroundColor: "#3b82f6" } })'),
  params: z.record(z.string(), z.unknown()).optional().describe('Advanced adapter parameters — omit in most cases')
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
    description:
      'Create a CSS selector entry in the space style for the specified display mode.\n\n' +
      'Defines a new class, element, or ID selector with optional initial CSS rules. ' +
      'Elements reference selectors via their styleSelectors map.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default createStyleSelectorTool;
