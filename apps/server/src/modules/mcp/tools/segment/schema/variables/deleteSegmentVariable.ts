import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  segmentId: z.string().describe('ID of the segment'),
  name: z.string().describe('Name of the variable to delete')
});

const deleteSegmentVariableTool: McpTool = {
  name: 'delete_segment_variable',
  adapterName: 'deleteSegmentVariable',
  mcpDefinition: {
    title: 'Delete Segment Variable',
    description:
      'Delete a schema variable from a segment.\n\n' +
      '━━ REQUIRED INPUT ━━\n' +
      'segmentId: ID of the segment\n' +
      'name: Name of the variable to delete',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default deleteSegmentVariableTool;
