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
  name: z.string().describe('Token name to update'),
  value: z
    .union([z.string(), z.number(), z.record(z.string(), z.unknown())])
    .describe(
      'New token value. Use a plain string/number for a fixed value, or { light: "...", dark: "...", default: "..." } for theme-aware values'
    )
});

const outputSchema = z
  .object({
    category: z.string().describe('Token category: "color", "spacing", "shadow", or "custom"'),
    name: z.string().describe('Token name'),
    value: z.union([z.string(), z.number(), z.record(z.string(), z.string())]).describe('Updated token value')
  })
  .describe('The updated segment style variable');

const updateSegmentStyleVariableTool: McpTool = {
  name: 'update_segment_style_variable',
  adapterName: 'updateSegmentStyleVariable',
  mcpDefinition: {
    title: 'Update Segment Style Variable',
    description: 'Update an existing scoped CSS design token inside a segment (color, spacing, shadow, or custom).',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default updateSegmentStyleVariableTool;
