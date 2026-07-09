import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  segmentId: z.string().describe('ID of the segment'),
  category: z
    .nativeEnum(StyleVariableCategory)
    .describe(
      'Token category: "color" for hex/rgba values, "spacing" for size/spacing units, "shadow" for box-shadow values, "custom" for any other CSS property'
    ),
  name: z.string().describe('Token name — used as the CSS variable key (e.g. "primary", "md", "card")'),
  value: z
    .union([z.string(), z.number(), z.record(z.string(), z.unknown())])
    .describe(
      'Token value. Use a plain string/number for a fixed value, or { light: "...", dark: "...", default: "..." } for theme-aware values'
    )
});

const outputSchema = z
  .object({
    category: z.string().describe('Token category: "color", "spacing", "shadow", or "custom"'),
    name: z.string().describe('Token name'),
    value: z.union([z.string(), z.number(), z.record(z.string(), z.string())]).describe('Token value')
  })
  .describe('The created segment style variable');

const createSegmentStyleVariableTool: McpTool = {
  name: 'create_segment_style_variable',
  adapterName: 'createSegmentStyleVariable',
  mcpDefinition: {
    title: 'Create Segment Style Variable',
    description:
      'Create a scoped CSS design token inside a segment — a named value for color, spacing, shadow, or a custom CSS property.\n\n' +
      'Color values can be theme-aware: pass { light: "#fff", dark: "#000", default: "#fff" }. ' +
      'Scoped tokens only apply within this segment.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default createSegmentStyleVariableTool;
