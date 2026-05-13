import { z } from 'zod';

import { createTool, callAdapter } from '../../utils';

const displayModes = z.enum(['desktop', 'tablet', 'mobile']);
const tagTypes = z.enum(['class', 'element', 'id']);

const updateStyleSelectorTool = createTool<'updateStyleSelector'>(
  'update_style_selector',
  'Update a global style selector',
  z.object({
    displayMode: displayModes,
    selector: z.string(),
    type: tagTypes,
    path: z.string().optional(),
    style: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
    params: z.record(z.string(), z.unknown()).optional()
  }),
  'write',
  (args, adapters, ctx) => callAdapter('updateStyleSelector', args, adapters, ctx)
);

export default updateStyleSelectorTool;
