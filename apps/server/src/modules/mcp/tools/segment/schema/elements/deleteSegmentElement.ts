import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  segmentId: z.string().describe('ID of the segment'),
  elementId: z.string().describe('ID of the element to remove')
});

const outputSchema = z.object({
  data: z.literal(true).describe('Always true on successful deletion')
});

const deleteSegmentElementTool: McpTool = {
  name: 'delete_segment_element',
  adapterName: 'deleteSegmentElement',
  mcpDefinition: {
    title: 'Delete Segment Element',
    description: 'Remove an element from a segment.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default deleteSegmentElementTool;
