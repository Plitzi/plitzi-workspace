import { z } from 'zod';

import { getAllowedModes, zodToJsonSchema } from '../../helpers';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  identifier: z.string().describe('S3 key / resource path to delete'),
  cdnIdentifier: z.string().describe('CDN identifier')
});

const outputSchema = z.object({
  data: z
    .object({
      id: z.string().describe('The deleted resource identifier')
    })
    .describe('Deleted resource confirmation')
});

const removeResourceTool: McpTool = {
  name: 'remove_resource',
  adapterName: 'removeResource',
  mcpDefinition: {
    title: 'Remove Resource',
    description:
      'Delete a resource from the CDN.\n\n' +
      'Plugin resources are deleted recursively (entire plugin folder). ' +
      'Asset and template resources are deleted as single files. ' +
      'The CDN cache is invalidated after deletion.',
    inputSchema,
    outputSchema
  },
  definition: {
    operationType: 'write',
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes('write')
  }
};

export default removeResourceTool;
