import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';
import { elementSchema } from '../schemas';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

const outputSchema = z.array(elementSchema).describe('All page elements in the space');

const getPagesTool: McpTool = {
  name: 'get_pages',
  adapterName: 'getPages',
  mcpDefinition: {
    title: 'Get Pages',
    description:
      'List all pages in the space.\n\n' +
      'Each page is an element with type "page". Page attributes include slug, name, default, and folder (folder ID). ' +
      'Use get_page to fetch a specific page with its full element tree.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default getPagesTool;
