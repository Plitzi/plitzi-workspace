import { z } from 'zod';

import { createTool, callAdapter } from '../utils';

const listPluginsTool = createTool<'listPlugins'>(
  'list_plugins',
  'List all plugins registered in the system',
  z.object({}),
  'read',
  (args, adapters, ctx) => callAdapter('listPlugins', args, adapters, ctx)
);

export default listPluginsTool;
