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
  url: z.string().describe('Source URL to fetch and upload as a resource'),
  cdnIdentifier: z
    .string()
    .describe(
      'CDN identifier to upload to — call get_resources first and use the cdnIdentifier from an existing resource of the same type (images share one CDN, plugins another)'
    ),
  filename: z.string().optional().describe('Override filename (defaults from URL)'),
  type: z.string().optional().describe('Resource type hint: "plugin", "template", or leave blank for auto-detect'),
  prefix: z.string().optional().describe('Subfolder prefix within the resource folder'),
  compression: z.string().optional().describe('Compression encoding (e.g. "gzip", "br")')
});

const outputSchema = resourceSchema.describe('The uploaded resource metadata');

const addResourceTool: McpTool = {
  name: 'add_resource',
  adapterName: 'addResource',
  mcpDefinition: {
    title: 'Add Resource',
    description:
      'Upload a resource to the space CDN by fetching from a URL.\n\n' +
      'The resource is downloaded from the provided URL, uploaded to the CDN, and the CDN cache is invalidated. ' +
      'Use for images, videos, or other static files.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default addResourceTool;
