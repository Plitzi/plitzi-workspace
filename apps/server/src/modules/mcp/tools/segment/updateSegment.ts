import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  segmentId: z.string().describe('ID of the segment to update'),
  updates: z
    .object({
      name: z.string().optional().describe('New name for the segment'),
      description: z.string().optional().describe('New description for the segment')
    })
    .describe('Fields to update')
});

const updateSegmentTool: McpTool = {
  name: 'update_segment',
  adapterName: 'updateSegment',
  mcpDefinition: {
    title: 'Update Segment',
    description: 'Update a segment',
    inputSchema
  },
  definition: {
    shortDescription: 'Update a segment',
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default updateSegmentTool;
