import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  segmentId: z.string().describe('ID of the segment to delete')
});

const deleteSegmentTool: McpTool = {
  name: 'delete_segment',
  adapterName: 'deleteSegment',
  mcpDefinition: {
    title: 'Delete Segment',
    description:
      'Delete a segment.\n\n' +
      '━━ REQUIRED INPUT ━━\n' +
      'segmentId: ID of the segment to delete\n\n' +
      '━━ WARNING ━━\n' +
      'This permanently removes the segment and all its contents.',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default deleteSegmentTool;
