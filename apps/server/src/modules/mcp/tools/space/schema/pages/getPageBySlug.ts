import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';
import { elementSchema } from '../schemas';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  slug: z.string().describe('URL slug of the page to find (e.g. "about-us")')
});

const outputSchema = elementSchema.nullable().describe('The matching page element, or null if not found');

const getPageBySlugTool: McpTool = {
  name: 'get_page_by_slug',
  adapterName: 'getPageBySlug',
  mcpDefinition: {
    title: 'Get Page By Slug',
    description:
      'Find a page by its URL slug.\n\n' +
      'Useful when you know the route path but not the element ID. ' +
      'Use get_pages to list all pages with their slugs.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default getPageBySlugTool;
