import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  segmentId: z.string().describe('ID of the segment'),
  element: z
    .object({
      type: z.string().describe('Component type'),
      label: z.string().describe('Human-readable name for the element'),
      props: z.record(z.string(), z.unknown()).optional().describe('Component props')
    })
    .describe('Element to add'),
  parentId: z.string().describe('Parent element ID')
});

const createSegmentElementTool: McpTool = {
  name: 'create_segment_element',
  adapterName: 'createSegmentElement',
  mcpDefinition: {
    title: 'Create Segment Element',
    description: 'Add an element to a segment.',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default createSegmentElementTool;
