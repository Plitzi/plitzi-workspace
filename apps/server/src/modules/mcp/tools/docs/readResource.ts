import { z } from 'zod';

import { getAllowedModes, toolResponseErr, toolResponseOk } from '../../helpers';
import { getResourceByUri } from '../../resources';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  uri: z.string().describe('Resource URI to read, e.g. "plitzi://docs/element". Call list_resources to see valid URIs.')
});

const readResourceTool: McpTool = {
  name: 'read_resource',
  mcpDefinition: {
    title: 'Read Resource',
    description:
      'Read a domain documentation resource (a glossary entry or a workflow) by its URI.\n\n' +
      'Read the matching resource before performing the related task. Use list_resources first if unsure of the URI.',
    inputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  },
  handler: ({ uri }: { uri: string }) => {
    const resource = getResourceByUri(uri);
    if (!resource) {
      return toolResponseErr(`Resource not found: ${uri}. Call list_resources to see available URIs.`);
    }

    return toolResponseOk({ uri: resource.uri, name: resource.name }, resource.content);
  }
};

export default readResourceTool;
