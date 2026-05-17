import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  segmentId: z.string().describe('ID of the segment'),
  elementId: z.string().describe('ID of the element to update'),
  updates: z
    .object({
      label: z.string().optional().describe('New label for the element'),
      props: z.record(z.string(), z.unknown()).optional().describe('New props for the element')
    })
    .describe('Fields to update')
});

const updateSegmentElementTool: McpTool = {
  name: 'update_segment_element',
  adapterName: 'updateSegmentElement',
  mcpDefinition: {
    title: 'Update Segment Element',
    description:
      'Update an element inside a segment.\n\n' +
      '━━ REQUIRED INPUT ━━\n' +
      'segmentId: ID of the segment\n' +
      'elementId: ID of the element to update\n\n' +
      '━━ OPTIONAL UPDATES ━━\n' +
      'updates.label: New label\n' +
      'updates.props: New props',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default updateSegmentElementTool;
