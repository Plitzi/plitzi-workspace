import { z } from 'zod';

import { getAllowedModes } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  segmentId: z.string().optional().describe('Segment ID (_id). Provide either segmentId or identifier.'),
  identifier: z.string().optional().describe('Segment identifier string. Provide either segmentId or identifier.')
});

const outputSchema = z
  .record(z.string(), z.unknown())
  .nullable()
  .describe('Full segment object including schema and style, or null if not found');

const getSegmentTool: McpTool = {
  name: 'get_segment',
  adapterName: 'getSegment',
  mcpDefinition: {
    title: 'Get Segment',
    description:
      'Get the full details of a specific segment by ID or identifier — includes its schema (element tree) and style.\n\n' +
      'Use get_segments to list available segments first if you do not know the ID or identifier.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default getSegmentTool;
