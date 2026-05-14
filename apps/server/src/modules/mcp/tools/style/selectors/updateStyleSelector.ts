import { z } from 'zod';

import type { McpToolAdapterDefinition } from '@plitzi/sdk-shared';

const displayModes = z.enum(['desktop', 'tablet', 'mobile']);
const tagTypes = z.enum(['class', 'element', 'id']);

const updateStyleSelectorTool: McpToolAdapterDefinition = {
  name: 'update_style_selector',
  adapterName: 'updateStyleSelector',
  description: 'Update a global style selector',
  inputSchema: z.object({
    displayMode: displayModes,
    selector: z.string(),
    type: tagTypes,
    path: z.string().optional(),
    style: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
    params: z.record(z.string(), z.unknown()).optional()
  }),
  operationType: 'write'
};

export default updateStyleSelectorTool;
