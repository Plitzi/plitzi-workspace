import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  segmentId: z.string().describe('ID of the segment'),
  name: z.string().describe('Name of the variable to delete')
});

const outputSchema = z.literal(true).describe('Always true on successful deletion');

const deleteSegmentVariableTool: McpTool = {
  name: 'delete_segment_variable',
  adapterName: 'deleteSegmentVariable',
  mcpDefinition: {
    title: 'Delete Segment Variable',
    description: 'Delete a schema variable from a segment. Any element bindings referencing this variable will break.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default deleteSegmentVariableTool;
