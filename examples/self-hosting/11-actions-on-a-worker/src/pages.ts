import { engineOnWorker } from '@plitzi/sdk-actions/worker';
import { closeOnSignals } from '@plitzi/sdk-kernel/http';
import { consoleLogger } from '@plitzi/sdk-kernel/log';
import { createJsonAdapters, createServer } from '@plitzi/sdk-server';

import { actionsOrigin, addresses } from './addresses.ts';
import { offlineData } from './space.ts';

/**
 * The page server: it renders the pages and runs none of their actions. `engineOnWorker` tells each page where to call
 * them — `/_action` on its own origin, which the gateway sends to the worker, or the worker's own origin when it is on
 * one (`action.origin`). It needs nothing of the engine installed to do that: no lookups, no store, no queue.
 */
const server = createServer({
  port: addresses.pages.port,
  devMode: process.env.NODE_ENV !== 'production',
  logger: consoleLogger,
  adapters: createJsonAdapters({ offlineData }),
  engine: engineOnWorker({ ...(actionsOrigin ? { action: { origin: actionsOrigin } } : {}), realtime: false })
});

await server.listen(addresses.pages.port, addresses.host);
closeOnSignals(server);
// Started by `main.ts`, the part in front waits for this one.
process.send?.('listening');

console.log(`[pages] on ${addresses.pages.url}/ — actions called at ${actionsOrigin ?? 'this origin'}`);
