import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const displayModes = z.enum(['desktop', 'tablet', 'mobile']);

const deleteStyleSelectorTool: McpToolAdapterDefinition = {
  name: 'delete_style_selector',
  adapterName: 'deleteStyleSelector',
  description: 'Delete a global style selector',
  inputSchema: z.object({ displayMode: displayModes, selector: z.string() }),
  operationType: 'write'
};

export default deleteStyleSelectorTool;
