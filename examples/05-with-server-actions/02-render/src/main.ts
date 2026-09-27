import { consoleLogger, createJsonAdapters, createServer } from '@plitzi/sdk-server';

import { lookups } from './actions.ts';
import { offlineData } from './space.ts';

const PORT = Number(process.env.PORT ?? 4011);
// Loopback unless told otherwise: a container publishes a port only from an address it listens on.
const HOST = process.env.HOST ?? '127.0.0.1';

const space = offlineData();

/**
 * A page server that runs an action while it renders.
 *
 * `action.lookups` is the whole of turning it on. There is no `tasks` here and no connector: the flow is built
 * from the steps `sdk-server` ships, and the RSC adapter that feeds a `runtime: 'server'` element is assembled
 * from these lookups rather than written out again by the deployment.
 */
const server = createServer({
  devMode: process.env.NODE_ENV !== 'production',
  logger: consoleLogger,
  adapters: createJsonAdapters({ offlineData: space, deployment: { spaceId: 1, environment: 'main', revision: 0 } }),
  /**
   * Both caches off, because this page is the argument for them being configurable.
   *
   * The HTML is cached for five minutes by default and the RSC payload for thirty seconds — sane for a page whose
   * content is the same for everyone, and exactly wrong for one whose whole point is a different answer on every
   * reload. A cache is the first thing to look at when the server's work stops showing.
   */
  cacheTtlMs: 0,
  rsc: { cacheTtlMs: 0 },
  action: {
    lookups,
    // Every render that fetched, in the terminal: the request is the server's, so this is where it is visible.
    onRun: record =>
      console.log(`[example] run ${record.actionId} via ${record.trigger} — ${record.status} in ${record.durationMs}ms`)
  }
});

server.listen(PORT, HOST);

console.log(`[example] cats on http://127.0.0.1:${PORT}/`);
console.log(`[example] fewer cats: http://127.0.0.1:${PORT}/?limit=3`);
console.log(`[example] the slice alone: curl -s 'http://127.0.0.1:${PORT}/_rsc?location=%2F'`);
