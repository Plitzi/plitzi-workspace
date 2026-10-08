import { closeOnSignals, consoleLogger, createJsonAdapters, createServer } from '@plitzi/sdk-server';
import { createRejectLogger, createRunLogger } from '@plitzi/sdk-server/actions';
import { serveRuntime } from '@plitzi/sdk-server/runtime';

import { lookups } from './actions.ts';
import pulse from './runtime.ts';
import { offlineData } from './space.ts';

const PORT = Number(process.env.PORT ?? 4017);
// Loopback unless told otherwise: a container publishes a port only from an address it listens on.
const HOST = process.env.HOST ?? '127.0.0.1';

/** Where people reach this server: `PUBLIC_URL` behind a proxy, its own address otherwise. */
const publicUrl = (process.env.PUBLIC_URL ?? `http://127.0.0.1:${String(PORT)}`).replace(/\/+$/, '');

/**
 * The runtime loaded into a server of your own — what the platform does beside a space, done here: its functions join
 * this server's (`native`), and its endpoints answer as a stage before anything else. Its variables are this process's
 * environment.
 */
const runtime = await serveRuntime(pulse, { env: process.env, publicUrl });

const server = createServer(
  {
    port: PORT,
    devMode: process.env.NODE_ENV !== 'production',
    logger: consoleLogger,
    adapters: createJsonAdapters({ offlineData }),
    functions: { native: runtime.native },
    action: {
      lookups,
      // Nothing here runs on a clock.
      jobs: false,
      onRun: createRunLogger(consoleLogger),
      onReject: createRejectLogger(consoleLogger)
    }
  },
  { preAuth: [runtime.stage] }
);

await server.listen(PORT, HOST);
closeOnSignals(server, { afterClose: () => runtime.close() });

console.log(
  `[runtime] the page on ${publicUrl}/ — its count at ${publicUrl}/fn/visits, its pulse at ${publicUrl}/pulse`
);
