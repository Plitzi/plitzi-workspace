import { z } from 'zod';

import { createTool, callAdapter } from '../../utils';

const getElementTool = createTool<'getElement'>(
  'get_element',
  'Get the full details of a single element by ID',
  z.object({ elementId: z.string().describe('Element ID') }),
  'read',
  (args, adapters, ctx) => callAdapter('getElement', args, adapters, ctx)
);

export default getElementTool;
