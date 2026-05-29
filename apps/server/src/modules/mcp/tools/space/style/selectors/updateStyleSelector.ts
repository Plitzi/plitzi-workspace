import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const displayModes = z.enum(['desktop', 'tablet', 'mobile']);
const tagTypes = z.enum(['class', 'element', 'id']);

const inputSchema = z.object({
  displayMode: displayModes.describe('Responsive breakpoint this selector applies to'),
  selector: z.string().describe('CSS selector string to update (e.g. ".hero-banner")'),
  type: tagTypes.describe('Selector kind: "class" for .className, "element" for HTML tag, "id" for #id'),
  path: z
    .string()
    .optional()
    .describe(
      'Targets a specific CSS property within a slot (e.g. "base.backgroundColor"). ' +
        'When provided, only that property is updated or deleted. ' +
        'When omitted, the entire style object replaces all attributes of the selector.'
    ),
  style: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .optional()
    .describe(
      'CSS rules keyed by slot name (e.g. { base: { color: "#fff", padding: "16px" } }). ' +
        'Omitting or passing undefined/empty: with path → deletes that property; without path → clears all attributes.'
    ),
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
    .describe('The updated style selector')
});

const updateStyleSelectorTool: McpTool = {
  name: 'update_style_selector',
  adapterName: 'updateStyleSelector',
  mcpDefinition: {
    title: 'Update Style Selector',
    description:
      'Update the CSS rules of an existing style selector for the specified display mode.\n\n' +
      'Behavior depends on whether `path` is provided:\n' +
      '- No path: the `style` object replaces ALL attributes of the selector.\n' +
      '- With path: only the targeted CSS property is updated.\n' +
      '- With path + empty/undefined style: the targeted property is deleted.\n' +
      '- No path + empty/undefined style: all attributes are cleared from the selector.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default updateStyleSelectorTool;
