import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

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
  identifier: z.string().describe('Current S3 key / resource path to move'),
  cdnIdentifier: z.string().describe('CDN identifier'),
  prefix: z.string().describe('New subfolder prefix to move the resource into')
});

const outputSchema = z.object({
  data: resourceSchema.describe('The moved resource metadata at its new path')
});

const moveResourceTool: McpTool = {
  name: 'move_resource',
  adapterName: 'moveResource',
  mcpDefinition: {
    title: 'Move Resource',
    description:
      'Move a resource to a different subfolder within the same CDN.\n\n' +
      'Only asset resources can be moved (plugin and template resources are locked). ' +
      'The CDN cache is invalidated after the move.',
    inputSchema,
    outputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default moveResourceTool;
