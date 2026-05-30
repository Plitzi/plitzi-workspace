import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';
import { elementSchema } from '../schemas';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  pageId: z.string().describe('ID of the page to update'),
  updates: z
    .object({
      name: z.string().optional().describe('New display name for the page'),
      slug: z.string().optional().describe('New URL slug (e.g. "about-us")'),
      default: z.boolean().optional().describe('Set true to make this the default/home page'),
      folder: z.string().optional().describe('ID of the page folder to assign this page to')
    })
    .describe('Fields to update on the page')
});

const outputSchema = elementSchema.describe('The updated page element');

const updatePageTool: McpTool = {
  name: 'update_page',
  adapterName: 'updatePage',
  mcpDefinition: {
    title: 'Update Page',
    description:
      'Update page metadata — name, slug, default status, or folder assignment.\n\n' +
      'To set a page as the home/default page, pass default: true. ' +
      'Use get_pages to list all pages and their current slugs before updating.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('write')
  }
};

export default updatePageTool;
