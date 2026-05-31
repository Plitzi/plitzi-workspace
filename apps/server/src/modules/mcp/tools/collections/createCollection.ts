import { z } from 'zod';

import { getAllowedModes } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const createCollectionTool: McpTool = {
  name: 'create_collection',
  adapterName: 'createCollection',
  mcpDefinition: {
    title: 'Create Collection',
    description:
      'Create a new collection — a structured data store for the space.\n\n' +
      'Provide field definitions in fields as a map of field name to field config. ' +
      'Records can be created afterwards via create_collection_record.',
    inputSchema: z.object({
      name: z.string().describe('Singular collection name (e.g. "Product")'),
      namePlural: z.string().describe('Plural collection name (e.g. "Products")'),
      description: z.string().optional().describe('Short description of what this collection stores'),
      privacy: z
        .enum(['public', 'private'])
        .optional()
        .describe('"public" allows unauthenticated reads; "private" requires auth'),
      fields: z
        .record(z.string(), z.unknown())
        .describe('Field definitions keyed by field name — each value is a field config object')
    }),
    outputSchema: z
      .object({
        id: z.string().describe('Collection ID'),
        name: z.string().describe('Collection name')
      })
      .catchall(z.unknown())
      .describe('The created collection')
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default createCollectionTool;
