import { consoleLogger, createJsonAdapters, createServer } from '@plitzi/sdk-server';

import { offlineDataPath } from '@plitzi/example-space';

const PORT = Number(process.env.PORT ?? 4003);
// Loopback unless told otherwise: a container publishes a port only from an address it listens on.
const HOST = process.env.HOST ?? '127.0.0.1';

/** Where the server gets a space from. `createJsonAdapters` is the file-backed shortcut: hand it a
 *  `{ schema, style }` JSON and it fills in the reads a page server needs. A real deployment swaps this for
 *  adapters that hit its own database — the server never learns the difference. */
const adapters = createJsonAdapters({ offlineData: offlineDataPath });

const server = createServer({
  port: PORT,
  devMode: process.env.NODE_ENV !== 'production',
  adapters,
  logger: consoleLogger
});

server.listen(PORT, HOST);
console.log(`[example] pages on http://127.0.0.1:${PORT}/`);
