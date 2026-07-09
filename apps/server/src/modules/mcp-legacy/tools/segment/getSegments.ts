import { z } from 'zod';

import { getAllowedModes } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from a previous response'),
  limit: z.number().int().min(1).max(100).optional().default(20).describe('Maximum number of segments to return')
});

const outputSchema = z
  .array(
    z.object({
      id: z.string().optional().describe('Segment ID'),
      identifier: z.string().describe('Segment identifier'),
      definition: z
        .object({
          name: z.string().describe('Segment name'),
          description: z.string().optional().describe('Segment description'),
          baseElementId: z.string().optional().describe('Root element ID')
        })
        .describe('Segment metadata')
    })
  )
  .describe('List of segments');

const getSegmentsTool: McpTool = {
  name: 'get_segments',
  adapterName: 'getSegments',
  mcpDefinition: {
    title: 'Get Segments',
    description:
      'List all segments in the space — reusable UI templates with their own isolated schema and style.\n\n' +
      'Returns name, identifier, and base element ID for each segment. ' +
      'Use get_segment with a segmentId to fetch the full schema and style of a specific segment.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default getSegmentsTool;
