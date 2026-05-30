import { z } from 'zod';

import { getAllowedModes } from '../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  schema: z
    .object({ flat: z.record(z.string(), z.unknown()) })
    .describe('Preview schema containing the flat element map'),
  style: z.record(z.string(), z.unknown()).optional().describe('Preview style to merge into the space style'),
  baseElementId: z.string().describe('Root element ID of the preview to insert'),
  targetParentId: z.string().describe('ID of the existing space element to insert the preview into'),
  dropPosition: z
    .enum(['inside', 'top', 'bottom', 'left', 'right', 'custom'])
    .optional()
    .default('inside')
    .describe('Where to place the preview relative to the target (default: inside as a child)')
});

const outputSchema = z.object({
  baseElementId: z.string().describe('Root element ID that was inserted'),
  targetParentId: z.string().describe('Parent element where the preview was inserted'),
  elementCount: z.number().describe('Total number of elements inserted')
});

const applyPreviewTool: McpTool = {
  name: 'apply_preview',
  adapterName: 'applyPreview',
  mcpDefinition: {
    title: 'Apply Preview',
    description:
      'Insert a preview (from stage_preview or sketch_wireframe) into the actual space schema.\n\n' +
      'Takes the schema and style from a previous preview result and writes them to the space. ' +
      'Use targetParentId to specify which existing element the preview should be inserted into ' +
      '(e.g. the current page ID). Optionally merges the preview style into the space style.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default applyPreviewTool;
