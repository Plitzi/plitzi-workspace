import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

const outputSchema = z.object({
  data: z
    .object({
      revision: z.number().describe('Revision number')
    })
    .describe('The published schema revision')
});

const publishSchemaTool: McpTool = {
  name: 'publish_schema',
  adapterName: 'publishSchema',
  mcpDefinition: {
    title: 'Publish Schema',
    description: 'Publish the current draft schema as a new immutable revision.',
    inputSchema,
    outputSchema
  },
  definition: {
    operationType: 'admin',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('admin')
  }
};

export default publishSchemaTool;
