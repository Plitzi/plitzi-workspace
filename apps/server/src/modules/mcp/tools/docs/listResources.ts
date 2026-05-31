import { z } from 'zod';

import { getAllowedModes, toolResponseOk } from '../../helpers';
import { getResourceList } from '../../resources';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

const listResourcesTool: McpTool = {
  name: 'list_resources',
  mcpDefinition: {
    title: 'List Resources',
    description:
      'List every available domain documentation resource (glossary entries and workflows) with its URI and a short description.\n\n' +
      'Use this to discover which resource to read, then call read_resource with the chosen URI.',
    inputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  },
  handler: () => toolResponseOk(getResourceList())
};

export default listResourcesTool;
