import { z } from 'zod';

import { getAllowedModes } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  segmentId: z.string().describe('ID of the segment to delete')
});

const outputSchema = z.object({
  data: z.literal(true).describe('Always true on successful deletion')
});

const deleteSegmentTool: McpTool = {
  name: 'delete_segment',
  adapterName: 'deleteSegment',
  mcpDefinition: {
    title: 'Delete Segment',
    description: 'Delete a segment.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default deleteSegmentTool;
