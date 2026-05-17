import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  name: z.string().describe('Name of the segment'),
  description: z.string().describe('Description of the segment')
});

const createSegmentTool: McpTool = {
  name: 'create_segment',
  adapterName: 'createSegment',
  mcpDefinition: {
    title: 'Create Segment',
    description:
      'Create a new segment (a reusable component with its own schema and style).\n\n' +
      '━━ REQUIRED INPUT ━━\n' +
      'name: Name of the segment\n' +
      'description: Description of what the segment does',
    inputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default createSegmentTool;
