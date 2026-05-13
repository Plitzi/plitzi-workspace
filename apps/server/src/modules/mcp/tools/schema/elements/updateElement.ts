import { z } from 'zod';

import { createTool, callAdapter } from '../../utils';

const updateElementTool = createTool<'updateElement'>(
  'update_element',
  'Update an existing element — label, props, styles, or runtime',
  z.object({
    elementId: z.string(),
    updates: z.object({
      label: z.string().optional(),
      props: z.record(z.string(), z.unknown()).optional(),
      styles: z.record(z.string(), z.unknown()).optional(),
      runtime: z.enum(['server', 'client', 'shared']).optional()
    })
  }),
  'write',
  (args, adapters, ctx) => callAdapter('updateElement', args, adapters, ctx)
);

export default updateElementTool;
