import { z } from 'zod';

import { createTool, callAdapter } from '../../utils';

const moveElementTool = createTool<'moveElement'>(
  'move_element',
  'Move an element to a different parent',
  z.object({
    elementId: z.string(),
    toParentId: z.string(),
    dropPosition: z.enum(['top', 'bottom', 'left', 'right', 'inside', 'custom']).optional()
  }),
  'write',
  (args, adapters, ctx) => callAdapter('moveElement', args, adapters, ctx)
);

export default moveElementTool;
