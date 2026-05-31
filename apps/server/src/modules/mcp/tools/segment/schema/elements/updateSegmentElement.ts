import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  segmentId: z.string().describe('ID of the segment'),
  elementId: z.string().describe('ID of the element to update'),
  updates: z
    .object({
      label: z.string().optional().describe('New label for the element'),
      props: z.record(z.string(), z.unknown()).optional().describe('New props for the element')
    })
    .describe('Fields to update')
});

const outputSchema = z
  .object({
    id: z.string().describe('Element ID')
  })
  .catchall(z.unknown())
  .describe('The updated segment element');

const updateSegmentElementTool: McpTool = {
  name: 'update_segment_element',
  adapterName: 'updateSegmentElement',
  mcpDefinition: {
    title: 'Update Segment Element',
    description: 'Update an element inside a segment.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default updateSegmentElementTool;
