import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { authorSpace } from '@plitzi/sdk-authoring';
import { consoleLogger, createJsonAdapters, createMemoryPubSub, createServer } from '@plitzi/sdk-server';
import { createRejectLogger, createRunLogger } from '@plitzi/sdk-server/actions';

import { lookups } from './actions.ts';
import { PLUGINS, space } from './space/index.ts';
import { boardTasks } from './tasks.ts';

const PORT = Number(process.env.PORT ?? 4016);
// Loopback unless told otherwise: a container publishes a port only from an address it listens on.
const HOST = process.env.HOST ?? '127.0.0.1';
const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * The elements this space ships itself: the canvas; the share card — a QR code and the clipboard, which are the
 * browser's to offer; and the sticky pads, which hand a note over the moment the pointer goes down. Two halves, and forgetting either is quiet: a plugin the server has no component for resolves
 * to nothing, on a page that renders perfectly.
 */
const plugins = {
  board: { js: path.resolve(here, 'plugins/Board/index.ts'), action: 'compile' as const },
  shareCard: { js: path.resolve(here, 'plugins/ShareCard/index.ts'), action: 'compile' as const },
  stickyStack: { js: path.resolve(here, 'plugins/StickyStack/index.ts'), action: 'compile' as const }
};

/** Authored at boot from `src/space`: saving a file and letting `start:dev` restart the process is the whole loop. */
const offlineData = authorSpace(space, { plugins: PLUGINS });

/**
 * A collaborative whiteboard, in one server and no account.
 *
 * Everything that makes it collaborative is two settings. `action` keeps the boards — five tasks over the action
 * `kv` — and `realtime` carries what changed to everyone looking.
 */
const server = createServer({
  port: PORT,
  devMode: process.env.NODE_ENV !== 'production',
  logger: consoleLogger,
  adapters: createJsonAdapters({
    offlineData,
    // `pluginNames` is how the render knows to load them. Without it the files are compiled by nobody.
    deployment: { spaceId: 1, environment: 'main', revision: 0, pluginNames: Object.keys(plugins) }
  }),
  plugins,
  action: {
    lookups,
    tasks: boardTasks,
    // Nothing here runs on a clock.
    jobs: false,
    onRun: createRunLogger(consoleLogger),
    onReject: createRejectLogger(consoleLogger)
  },
  /**
   * How a message reaches every page on its topic. In memory — the default, written out to show where the choice
   * is made — which is exactly right for one process and its workers. A deployment with a second replica hands it an
   * adapter they share instead: `createRedisPubSub({ publisher, subscriber })` over two Redis connections, or one
   * object of the same two methods over NATS, Postgres `LISTEN`, anything that fans a message out.
   */
  realtime: {
    pubsub: createMemoryPubSub(),
    /**
     * A socket per page rather than a stream and a request per message: twenty cursor updates a second from every
     * person on a board are frames on a connection that is already open, not twenty requests. A page falls back to
     * the stream by itself where a socket cannot open (behind HTTP/2, or a proxy that drops upgrades).
     */
    transport: 'websocket'
  }
});

server.listen(PORT, HOST);

console.log(`[whiteboard] the boards on http://127.0.0.1:${PORT}/`);
console.log('[whiteboard] open a board in two windows — every stroke, cursor and rename reaches the other');
