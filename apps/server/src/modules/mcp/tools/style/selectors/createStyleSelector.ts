import { z } from 'zod';

import { createTool, callAdapter } from '../../utils';

const displayModes = z.enum(['desktop', 'tablet', 'mobile']);
const tagTypes = z.enum(['class', 'element', 'id']);

const createStyleSelectorTool = createTool<'createStyleSelector'>(
  'create_style_selector',
  'Create a global style selector',
  z.object({
    displayMode: displayModes,
    selector: z.string(),
    type: tagTypes,
    path: z.string().optional(),
    style: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
    params: z.record(z.string(), z.unknown()).optional()
  }),
  'write',
  (args, adapters, ctx) => callAdapter('createStyleSelector', args, adapters, ctx)
);

export default createStyleSelectorTool;
