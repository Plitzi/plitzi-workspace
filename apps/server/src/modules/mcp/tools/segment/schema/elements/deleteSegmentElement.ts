import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  segmentId: z.string().describe('ID of the segment'),
  elementId: z.string().describe('ID of the element to remove')
});

const deleteSegmentElementTool: McpTool = {
  name: 'delete_segment_element',
  adapterName: 'deleteSegmentElement',
  mcpDefinition: {
    title: 'Delete Segment Element',
    description: 'Remove an element from a segment.',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default deleteSegmentElementTool;
