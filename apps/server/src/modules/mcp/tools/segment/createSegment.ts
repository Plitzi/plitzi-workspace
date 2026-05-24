import { z } from 'zod';

import { getAllowedModes } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  name: z.string().describe('Name of the segment'),
  description: z.string().describe('Description of the segment')
});

const outputSchema = z.object({
  data: z
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
    .describe('The created segment')
});

const createSegmentTool: McpTool = {
  name: 'create_segment',
  adapterName: 'createSegment',
  mcpDefinition: {
    title: 'Create Segment',
    description: 'Create a new segment (a reusable component with its own schema and style).',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default createSegmentTool;
