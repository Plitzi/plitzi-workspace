import { defineFunctions } from '@plitzi/sdk-server/functions';

import type { FunctionContext, FunctionTask } from '@plitzi/sdk-server/functions';

/**
 * The runtime's functions: written exactly as a space's functions are (`docs/en/functions.md`), with the server's `ctx`
 * — its `kv` here. On the platform that `kv` is the space's; self-hosted, the server's own.
 */

const VISITS_KEY = 'visits';

const readVisits = async (kv: FunctionContext['kv']): Promise<number> => {
  const value = await kv.get(VISITS_KEY);

  return typeof value === 'number' ? value : 0;
};

/** One more visit, counted where every replica of the server counts it: `ctx.kv.change` retries a lost race itself. */
const visitsCount: FunctionTask<Record<string, never>> = {
  namespace: 'visits',
  action: 'count',
  title: 'Count a Visit',
  description: 'One more visit, and how many there have been.',
  params: {},
  run: async (_params, ctx) => ({
    visits: (await ctx.kv.change<number>(VISITS_KEY, current => (typeof current === 'number' ? current : 0) + 1)) ?? 0
  })
};

/** How many there have been, without counting one. */
const visitsRead: FunctionTask<Record<string, never>> = {
  namespace: 'visits',
  action: 'read',
  title: 'Read Visits',
  description: 'How many visits there have been.',
  params: {},
  run: async (_params, ctx) => ({ visits: await readVisits(ctx.kv) })
};

export const functions = defineFunctions({
  tasks: [visitsCount, visitsRead],
  routes: {
    /** The same number for anything that is not a page — answered under `/api/`, as every function route is. */
    'GET /visits': async (_request, ctx) => Response.json({ visits: await readVisits(ctx.kv) })
  }
});
