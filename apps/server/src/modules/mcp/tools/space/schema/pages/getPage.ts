import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';
import { elementSchema } from '../schemas';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  pageId: z.string().describe('ID of the page to retrieve')
});

const outputSchema = z
  .object({
    page: elementSchema.describe('The page element with its attributes (slug, name, default, folder)'),
    elementIds: z.array(z.string()).describe('IDs of all elements belonging to this page')
  })
  .nullable()
  .describe('Page info and element IDs, or null if not found');

const getPageTool: McpTool = {
  name: 'get_page',
  adapterName: 'getPage',
  mcpDefinition: {
    title: 'Get Page',
    description:
      'Get a page by ID — returns the page element and the IDs of all its elements.\n\n' +
      'To inspect specific elements use list_elements with rootId set to the pageId, ' +
      'or get_element for a single element. Use get_pages to find available page IDs.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default getPageTool;
