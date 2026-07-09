import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  segmentId: z.string().describe('ID of the segment'),
  elementId: z.string().describe('ID of the element to move'),
  toParentId: z.string().describe('ID of the new parent element'),
  dropPosition: z
    .enum(['top', 'bottom', 'left', 'right', 'inside', 'custom'])
    .optional()
    .describe(
      'Where to drop relative to the target parent: "inside" appends as last child (default), "top"/"bottom" inserts before/after siblings'
    )
});

const outputSchema = z.literal(true).describe('Always true on successful move');

const moveSegmentElementTool: McpTool = {
  name: 'move_segment_element',
  adapterName: 'moveSegmentElement',
  mcpDefinition: {
    title: 'Move Segment Element',
    description: 'Move an element to a different parent or reorder it within its current parent inside a segment.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default moveSegmentElementTool;
