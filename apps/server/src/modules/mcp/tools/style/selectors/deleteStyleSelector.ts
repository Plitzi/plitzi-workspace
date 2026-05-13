import { z } from 'zod';

import { createTool, callAdapter } from '../../utils';

const displayModes = z.enum(['desktop', 'tablet', 'mobile']);

const deleteStyleSelectorTool = createTool<'deleteStyleSelector'>(
  'delete_style_selector',
  'Delete a global style selector',
  z.object({ displayMode: displayModes, selector: z.string() }),
  'write',
  (args, adapters, ctx) => callAdapter('deleteStyleSelector', args, adapters, ctx)
);

export default deleteStyleSelectorTool;
