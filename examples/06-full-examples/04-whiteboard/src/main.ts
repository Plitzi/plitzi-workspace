import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { authorSpace } from '@plitzi/sdk-authoring';
import { consoleLogger, createJsonAdapters, createMemoryPubSub, createServer } from '@plitzi/sdk-server';
import { createRejectLogger, createRunLogger } from '@plitzi/sdk-server/actions';

import { lookups } from './actions.ts';
import { readAsset } from './board/assets.ts';
import { PLUGINS, space } from './space/index.ts';
import { boardTasks } from './tasks.ts';

import type { SSRMiddleware } from '@plitzi/sdk-shared';

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
  stickyStack: { js: path.resolve(here, 'plugins/StickyStack/index.ts'), action: 'compile' as const },
  countdown: { js: path.resolve(here, 'plugins/Countdown/index.ts'), action: 'compile' as const }
};

/** `/board-assets/<board>/<asset>`: the picture an image element names, as its board keeps it. */
const ASSET_PATH = /^\/board-assets\/([a-z0-9]{10})\/([A-Za-z0-9_-]{16,32})$/;

/**
 * The pictures pasted onto boards, served beside the pages. Only an id the server made, only the type the bytes were
 * checked to be, and headers that keep a browser from reading them as anything else. Cached for good: an asset never
 * changes — a new picture is a new id.
 */
const serveAssets: SSRMiddleware = (req, res, next) => {
  const match = req.method === 'GET' ? ASSET_PATH.exec(req.path) : null;
  if (!match) {
    return next();
  }

  const asset = readAsset(match[1], match[2]);
  if (!asset) {
    res.setStatus(404);
    res.send('');

    return undefined;
  }

  res.setHeader('Content-Type', asset.mime);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.send(asset.bytes);

  return undefined;
};

/** Authored at boot from `src/space`: saving a file and letting `start:dev` restart the process is the whole loop. */
const offlineData = authorSpace(space, { plugins: PLUGINS });

/**
 * A collaborative whiteboard, in one server and no account.
 *
 * Everything that makes it collaborative is two settings. `action` keeps the boards — the `board.*` tasks over the
 * action `kv` — and `realtime` carries what changed to everyone looking. The one middleware serves the pictures pasted
 * onto them.
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
  middlewares: [serveAssets],
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
