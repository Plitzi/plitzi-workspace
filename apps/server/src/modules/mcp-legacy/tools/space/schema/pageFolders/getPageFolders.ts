import { z } from 'zod';

import { getAllowedModes } from '../../../../helpers';
import { pageFolderSchema } from '../schemas';

import type { McpTool } from '@plitzi/sdk-shared';

const inputSchema = z.object({});

const outputSchema = z.array(pageFolderSchema).describe('All page folders in the space');

const getPageFoldersTool: McpTool = {
  name: 'get_page_folders',
  adapterName: 'getPageFolders',
  mcpDefinition: {
    title: 'Get Page Folders',
    description:
      'List all page folders in the space.\n\n' +
      'Page folders organize pages into a hierarchy. Each folder has a name, slug, and optional parentId for nesting. ' +
      'Pages reference their folder via the folder attribute in their element attributes.',
    inputSchema,
    outputSchema
  },
  definition: {
    allowedModes: getAllowedModes('read')
  }
};

export default getPageFoldersTool;
