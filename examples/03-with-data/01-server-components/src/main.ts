import { consoleLogger, createJsonAdapters, createServer } from '@plitzi/sdk-server';

import { offlineDataPath } from '@plitzi/example-space';

import type { SSRRscContext, SSRRscData, SSRUser } from '@plitzi/sdk-shared';

const PORT = Number(process.env.PORT ?? 4004);

/** Server data, keyed by the schema element id that consumes it. The sample space carries three RSC elements —
 *  `rsc-server`, `rsc-client` and `rsc-shared` — and each reads its own slice through the SDK's `useRscData`.
 *
 *  This is where a real deployment queries its database, calls an internal service or reads a session: it runs
 *  on the server only, so credentials and query cost never reach the browser. */
const serverDataFor = (user: SSRUser | undefined): Record<string, unknown> => ({
  'rsc-server': {
    message: 'Rendered on the server',
    renderedAt: new Date().toISOString(),
    nodeVersion: process.version,
    authenticated: !!user
  },
  'rsc-shared': {
    serverTimestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime())
  }
});

/** Called once per page render, and again for each partial refresh the client asks for. `ids` is set on those
 *  partial calls — honour it and you do only the work that was requested instead of rebuilding every slice.
 *
 *  Everything arrives in one object, `loadOfflineData` included: that one is the space this render is already
 *  loading, so an adapter that needs the schema awaits it rather than fetching a second copy. */
// eslint-disable-next-line @typescript-eslint/require-await
const getRscData = async ({ user, ids }: SSRRscContext): Promise<SSRRscData> => {
  const all = serverDataFor(user);
  const serverData = ids?.length ? Object.fromEntries(ids.filter(id => id in all).map(id => [id, all[id]])) : all;

  return { serverData };
};

const server = createServer({
  port: PORT,
  devMode: true,
  // RSC turns itself on because `getRscData` exists — there is no separate flag to remember.
  adapters: { ...createJsonAdapters({ offlineData: offlineDataPath }), getRscData },
  logger: consoleLogger
});

const base = `http://127.0.0.1:${PORT}`;

server.listen(PORT, '127.0.0.1');
console.log(`[example] pages + RSC on http://127.0.0.1:${PORT}/`);
console.log(`[example] all slices:  curl '${base}/_rsc?location=%2F'`);
console.log(`[example] one slice:   curl '${base}/_rsc?location=%2F&ids=rsc-server'`);
