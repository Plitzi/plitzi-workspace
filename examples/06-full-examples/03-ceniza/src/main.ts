import { authorSpace } from '@plitzi/sdk-authoring';
import { consoleLogger, createJsonAdapters, createServer } from '@plitzi/sdk-server';
import { createRunLogger } from '@plitzi/sdk-server/actions';

import { lookups } from './actions';
import { space } from './space';

const PORT = Number(process.env.PORT ?? 4015);

/**
 * The space, held in this project.
 *
 * Authored at boot from `src/space.ts`, so saving a page and letting `start:dev` restart the process is the whole
 * edit loop.
 */
const offlineData = authorSpace(space);

const server = createServer({
  port: PORT,
  devMode: process.env.NODE_ENV !== 'production',
  adapters: createJsonAdapters({
    offlineData,
    deployment: { spaceId: 1, environment: 'main', revision: 0 }
  }),
  logger: consoleLogger,
  /**
   * The availability, the booking, the newsletter and the journal, run on this server (`src/actions`). `lookups` is
   * what turns `/_action` on for them. They bring no tasks of their own — every step is one `sdk-server` ships — and
   * `kv` is left to its in-process default, which is right for one process: a cluster passes a shared store here.
   *
   * `allowPrivateHosts` because the space's SMTP credential names the Mailpit on this machine. A hosted server leaves
   * it off: a credential is typed by a customer, and the connection starts inside the server's own network.
   */
  action: { lookups, email: { allowPrivateHosts: true }, onRun: createRunLogger(consoleLogger) }
});

server.listen(PORT, '127.0.0.1');
console.log(`pages on http://127.0.0.1:${PORT}/`);
