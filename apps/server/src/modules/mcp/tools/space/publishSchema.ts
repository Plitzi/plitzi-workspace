import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

const publishSchemaTool: McpTool = {
  name: 'publish_schema',
  adapterName: 'publishSchema',
  mcpDefinition: {
    title: 'Publish Schema',
    description: 'Publish the current draft schema as a new immutable revision.',
    inputSchema
  },
  definition: {
    operationType: 'admin',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('admin')
  }
};

export default publishSchemaTool;
