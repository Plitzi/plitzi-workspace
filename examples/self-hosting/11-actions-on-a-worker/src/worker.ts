import { createRejectLogger, createRunLogger } from '@plitzi/sdk-actions';
import { createWorker } from '@plitzi/sdk-actions/worker';
import { closeOnSignals } from '@plitzi/sdk-kernel/http';
import { consoleLogger } from '@plitzi/sdk-kernel/log';

import { lookups } from './actions.ts';
import { actionsOrigin, addresses } from './addresses.ts';

/**
 * The worker: the actions engine as a server of its own, on `@plitzi/sdk-kernel` — no page, no render. It reads the
 * same space the page server does (which space a host is, its documents) and holds what a run needs: the actions'
 * documents, the space's kv. Every other process of the deployment may be restarted, scaled or moved without it.
 *
 * On an origin of its own it is told so (`action.origin`) and which pages call it (`pageOrigins`): it answers them with
 * CORS and credentials, and refuses every other site's write. It refuses to start with the first and not the second.
 */
/**
 * What the worker reads of the space: which one a request is (here, the only one) and its documents. Two functions,
 * not `@plitzi/sdk-server`'s adapters — the worker installs and loads nothing of the page server.
 */
const adapters = {
  getSpaceDeployment: () => Promise.resolve({ spaceId: 1, environment: 'main' as const, revision: 0 }),
  // Read when a run asks for the space's documents, never at start.
  getOfflineData: async () => (await import('./space.ts')).offlineData
};

const worker = createWorker({
  port: addresses.worker.port,
  logger: consoleLogger,
  adapters,
  action: {
    lookups,
    ...(actionsOrigin ? { origin: actionsOrigin, pageOrigins: [addresses.pages.url] } : {}),
    // Nothing here runs on a clock.
    jobs: false,
    onRun: createRunLogger(consoleLogger),
    onReject: createRejectLogger(consoleLogger)
  },
  realtime: false
});

await worker.listen(addresses.worker.port, addresses.host);
closeOnSignals(worker);
// Started by `main.ts`, the part in front waits for this one.
process.send?.('listening');

console.log(`[worker] on ${addresses.worker.url} — /_action and /fn, and nothing else`);
