import { createServer } from '@plitzi/sdk-server';

import { actionSpace, FEED_ACTION } from '../spaces';

import type { ActionEntry } from '@plitzi/sdk-shared';

/**
 * The suite's server for one wiring in particular: **actions and nothing else.**
 *
 * Its own process rather than a flag on `server/main.ts`, because what it is about is what it does NOT have. That
 * one writes its own `getRscData` and needs to — its RSC specs are about the three runtimes and their slices —
 * and an adapter the deployment supplies is precisely the case where the server stops assembling one. Here there
 * is no adapter, no connector and no plugin: a page, an action, and the expectation that a `runtime: 'server'`
 * element still resolves.
 *
 * A space wired this way is ordinary — the read a manifest cannot express is what actions are for — and for a
 * while it rendered empty sections with nothing missing from its configuration.
 */

export const PORT = Number(process.env.PORT ?? 5202);

const space = actionSpace();

const lookups = {
  getAction: (_spaceId: number, actionId: string): Promise<ActionEntry | undefined> =>
    Promise.resolve(actionId === FEED_ACTION.id ? (FEED_ACTION as ActionEntry) : undefined)
};

const server = createServer({
  port: PORT,
  devMode: true,
  adapters: {
    getOfflineData: () => Promise.resolve(space),
    getSpaceDeployment: () => Promise.resolve({ spaceId: 1, environment: 'main', revision: 0 })
  },
  /**
   * Caches off: several specs render the same URL and read what came back per request, and a five-minute HTML
   * cache would answer the second one with the first one's page.
   */
  cacheTtlMs: 0,
  rsc: { cacheTtlMs: 0 },
  action: { lookups }
});

server.listen(PORT, '127.0.0.1');
console.log(`[e2e] pages fed by actions on http://127.0.0.1:${PORT}/`);
