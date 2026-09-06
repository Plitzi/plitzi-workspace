import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { consoleLogger, createJsonAdapters, createServer } from '@plitzi/sdk-server';

import { offlineDataPath } from '@plitzi/example-space';

import type { SSRRscContext, SSRRscData, SSRUser } from '@plitzi/sdk-shared';

const PORT = Number(process.env.PORT ?? 4004);
const here = path.dirname(fileURLToPath(import.meta.url));

/** RSC data is keyed by the ELEMENT ID — which is the name the space gave the element, so there is nothing to look
 *  up: `rsc-server` here is the same `rsc-server` written in the declaration. */
const ids = { server: 'rsc-server', shared: 'rsc-shared' };

/** Server data, keyed by the schema element id that consumes it. The sample space carries three RSC elements —
 *  `rsc-server`, `rsc-client` and `rsc-shared` — and each reads its own slice through the SDK's `useRscData`.
 *
 *  This is where a real deployment queries its database, calls an internal service or reads a session: it runs
 *  on the server only, so credentials and query cost never reach the browser. */
const serverDataFor = (user: SSRUser | undefined): Record<string, unknown> => ({
  [ids.server]: {
    message: 'Rendered on the server',
    renderedAt: new Date().toISOString(),
    nodeVersion: process.version,
    authenticated: !!user
  },
  [ids.shared]: {
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

/** The other half of an RSC element, and the one that is easy to forget: `getRscData` supplies the DATA, and a
 *  component still has to render it. `serverInfo`, `clientInfo` and `sharedInfo` are element types this space uses
 *  and the SDK does not ship — so this deployment provides them, and names them in its deployment record.
 *
 *  Miss either half and the elements resolve to nothing: the page renders, the section they live in is empty, and
 *  no error is raised anywhere. */
const plugins = {
  serverInfo: { js: path.resolve(here, 'plugins/ServerInfo.tsx'), action: 'compile' as const },
  clientInfo: { js: path.resolve(here, 'plugins/ClientInfo.tsx'), action: 'compile' as const },
  sharedInfo: { js: path.resolve(here, 'plugins/SharedInfo.tsx'), action: 'compile' as const }
};

const server = createServer({
  port: PORT,
  devMode: true,
  // RSC turns itself on because `getRscData` exists — there is no separate flag to remember.
  adapters: {
    ...createJsonAdapters({
      offlineData: offlineDataPath,
      deployment: { spaceId: 1, environment: 'main', revision: 0, pluginNames: Object.keys(plugins) }
    }),
    getRscData
  },
  plugins,
  logger: consoleLogger
});

const base = `http://127.0.0.1:${PORT}`;

server.listen(PORT, '127.0.0.1');
console.log(`[example] pages + RSC on http://127.0.0.1:${PORT}/`);
console.log(`[example] all slices:  curl '${base}/_rsc?location=%2F'`);
console.log(`[example] one slice:   curl '${base}/_rsc?location=%2F&ids=${ids.server}'`);
