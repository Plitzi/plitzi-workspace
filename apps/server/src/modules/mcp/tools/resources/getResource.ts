import { z } from 'zod';

import { getAllowedModes } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const resourceSchema = z.object({
  id: z.string().describe('S3 key / resource path'),
  name: z.string().describe('Filename'),
  path: z.string().describe('Full CDN URL'),
  type: z.string().describe('Resource type (image, video, application, plugin, template, unknown)'),
  size: z.number().describe('File size in bytes'),
  cdnIdentifier: z.string().describe('CDN identifier'),
  created_at: z.number().describe('Unix timestamp of creation'),
  updated_at: z.number().describe('Unix timestamp of last update')
});

const inputSchema = z.object({
  identifier: z.string().describe('S3 key / resource path to look up'),
  cdnIdentifier: z.string().describe('CDN identifier')
});

const outputSchema = resourceSchema.nullable().describe('The resource metadata, or null if not found');

const getResourceTool: McpTool = {
  name: 'get_resource',
  adapterName: 'getResource',
  mcpDefinition: {
    title: 'Get Resource',
    description: 'Get metadata for a single resource by its S3 key.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default getResourceTool;
