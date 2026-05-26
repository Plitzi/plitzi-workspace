import { z } from 'zod';

import { getAllowedModes } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

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

const outputSchema = z.object({
  data: z
    .object({
      resources: z.array(resourceSchema).describe('List of resources for the current space')
    })
    .describe('Resources list')
});

const getResourcesTool: McpTool = {
  name: 'get_resources',
  adapterName: 'getResources',
  mcpDefinition: {
    title: 'Get Resources',
    description: 'List all CDN resources (images, videos, documents, plugins, templates) for the current space.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default getResourcesTool;
