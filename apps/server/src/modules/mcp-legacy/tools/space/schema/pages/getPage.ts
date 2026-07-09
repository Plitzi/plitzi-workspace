import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';
import { elementSchema } from '../schemas';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({
  pageId: z.string().describe('ID of the page to retrieve')
});

const pageElementSchema = z.object({
  id: z.string().describe('Element ID'),
  label: z.string().describe('Human-readable element label'),
  type: z.string().describe('Element type (e.g. "button", "text", "box")'),
  parentId: z.string().nullable().describe('Parent element ID, or null for root elements'),
  attributes: z
    .record(z.string(), z.unknown())
    .describe('Element attributes/props — includes its current content, text, classes, etc.')
});

const outputSchema = z
  .object({
    page: elementSchema.describe('The page element with its attributes (slug, name, default, folder)'),
    elements: z
      .array(pageElementSchema)
      .describe('Every element on the page with its label, type, parent and current attributes')
  })
  .nullable()
  .describe('Page info and its elements, or null if not found');

const getPageTool: McpTool = {
  name: 'get_page',
  adapterName: 'getPage',
  mcpDefinition: {
    title: 'Get Page',
    description:
      'Get a page by ID — returns the page element and every element on it (id, label, type, parentId and ' +
      'current attributes). Usually enough to find an element and read or change its content/props without ' +
      'further calls. Use get_pages to find available page IDs; get_element only for one element in isolation.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default getPageTool;
