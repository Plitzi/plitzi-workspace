import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  segmentId: z.string().describe('ID of the segment'),
  elementId: z.string().describe('ID of the element to move'),
  toParentId: z.string().describe('ID of the new parent element'),
  dropPosition: z
    .enum(['top', 'bottom', 'left', 'right', 'inside', 'custom'])
    .optional()
    .describe('Position within the new parent')
});

const moveSegmentElementTool: McpTool = {
  name: 'move_segment_element',
  adapterName: 'moveSegmentElement',
  mcpDefinition: {
    title: 'Move Segment Element',
    description:
      'Move an element inside a segment.\n\n' +
      '━━ REQUIRED INPUT ━━\n' +
      'segmentId: ID of the segment\n' +
      'elementId: ID of the element to move\n' +
      'toParentId: ID of the new parent element\n\n' +
      '━━ OPTIONAL INPUT ━━\n' +
      'dropPosition: Position (top | bottom | left | right | inside | custom)',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default moveSegmentElementTool;
