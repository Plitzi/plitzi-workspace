import { z } from 'zod';

import { getAllowedModes } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

const outputSchema = z.object({
  data: z
    .object({
      revision: z.number().describe('Revision number')
    })
    .describe('The published schema revision')
});

const publishSpaceTool: McpTool = {
  name: 'publish_space',
  adapterName: 'publishSpace',
  mcpDefinition: {
    title: 'Publish Space',
    description: 'Publish the current draft space as a new immutable revision.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default publishSpaceTool;
