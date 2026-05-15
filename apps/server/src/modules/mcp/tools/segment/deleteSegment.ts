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
    description: 'Delete a segment',
    inputSchema
  },
  definition: {
    shortDescription: 'Delete a segment',
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default deleteSegmentTool;
