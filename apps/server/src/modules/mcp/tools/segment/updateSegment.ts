import { z } from 'zod';

import { getAllowedModes } from '../../helpers';

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

const outputSchema = z
  .object({
    identifier: z.string().describe('Segment identifier'),
    definition: z
      .object({
        name: z.string().describe('Segment name'),
        description: z.string().describe('Segment description'),
        baseElementId: z.string().describe('Root element ID')
      })
      .describe('Segment definition'),
    id: z.string().optional().describe('Segment ID')
  })
  .describe('The updated segment');

const updateSegmentTool: McpTool = {
  name: 'update_segment',
  adapterName: 'updateSegment',
  mcpDefinition: {
    title: 'Update Segment',
    description: 'Update a segment name or description.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default updateSegmentTool;
