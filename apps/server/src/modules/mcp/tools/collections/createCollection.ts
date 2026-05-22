import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const createCollectionTool: McpTool = {
  name: 'create_collection',
  adapterName: 'createCollection',
  mcpDefinition: {
    title: 'Create Collection',
    description: 'Create a new collection.',
    inputSchema: z.object({
      name: z.string().describe('Collection name'),
      namePlural: z.string().describe('Collection name plural'),
      description: z.string().optional().describe('Collection description'),
      privacy: z.enum(['public', 'private']).optional().describe('Collection privacy'),
      fields: z.record(z.any()).describe('Collection fields')
    })
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(
      z.object({
        name: z.string().describe('Collection name'),
        namePlural: z.string().describe('Collection name plural'),
        description: z.string().optional().describe('Collection description'),
        privacy: z.enum(['public', 'private']).optional().describe('Collection privacy'),
        fields: z.record(z.any()).describe('Collection fields')
      })
    ),
    allowedModes: getAllowedModes('write')
  }
};

export default createCollectionTool;
