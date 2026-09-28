import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { authorSpace } from '@plitzi/sdk-authoring';
import { closeOnSignals, consoleLogger, createJsonAdapters, createServer } from '@plitzi/sdk-server';
import { createRejectLogger, createRunLogger } from '@plitzi/sdk-server/actions';
import { serveRuntime } from '@plitzi/sdk-server/runtime';

import { lookups } from './actions.ts';
import { AGENT_PATH } from './agent/hosted.ts';
import { serverStoresFrom } from './deployment.ts';
import pizarra from './runtime.ts';
import { PLUGINS, space } from './space/index.ts';

const PORT = Number(process.env.PORT ?? 4016);
// Loopback unless told otherwise: a container publishes a port only from an address it listens on.
const HOST = process.env.HOST ?? '127.0.0.1';
const here = path.dirname(fileURLToPath(import.meta.url));

/** Where people reach this Pizarra: `PIZARRA_PUBLIC_URL` behind a proxy, its own address otherwise. */
const publicUrl = (process.env.PIZARRA_PUBLIC_URL ?? `http://127.0.0.1:${String(PORT)}`).replace(/\/+$/, '');

/**
 * Pizarra self-hosted: the server the platform would be — the boards' `kv`, the channels, the key things are signed
 * with — decided by the environment (`deployment.ts`), and Pizarra's own runtime loaded into it, the same module the
 * platform runs beside a space (`runtime.ts`).
 */
const stores = serverStoresFrom(process.env);
const runtime = await serveRuntime(pizarra, { env: process.env, publicUrl });

/**
 * The elements this space ships itself: the canvas; the share card — a QR code and the clipboard, which are the
 * browser's to offer; the sticky pile, which hands a pile over the moment the pointer goes down; the countdown; and a
 * text to copy. Two halves, and forgetting either is quiet: a plugin the server has no component for resolves to
 * nothing, on a page that renders perfectly.
 */
const plugins = {
  board: { js: path.resolve(here, 'plugins/Board/index.ts'), action: 'compile' as const },
  shareCard: { js: path.resolve(here, 'plugins/ShareCard/index.ts'), action: 'compile' as const },
  stickyStack: { js: path.resolve(here, 'plugins/StickyStack/index.ts'), action: 'compile' as const },
  countdown: { js: path.resolve(here, 'plugins/Countdown/index.ts'), action: 'compile' as const },
  copyText: { js: path.resolve(here, 'plugins/CopyText/index.ts'), action: 'compile' as const }
};

/** Authored at boot from `src/space`: saving a file and letting `start:dev` restart the process is the whole loop. */
const offlineData = authorSpace(space, { plugins: PLUGINS });

/**
 * A collaborative whiteboard, in one server and no account.
 *
 * Everything that makes it collaborative is two settings. `action` keeps the boards — the `board.*` tasks over the
 * action `kv` — and `realtime` carries what changed to everyone looking. The runtime's routes serve the pictures pasted
 * onto them, and its endpoint is the agents'.
 */
const server = createServer(
  {
    port: PORT,
    devMode: process.env.NODE_ENV !== 'production',
    logger: consoleLogger,
    adapters: createJsonAdapters({
      offlineData,
      // `pluginNames` is how the render knows to load them. Without it the files are compiled by nobody.
      deployment: { spaceId: 1, environment: 'main', revision: 0, pluginNames: Object.keys(plugins) }
    }),
    plugins,
    functions: { native: runtime.native },
    action: {
      lookups,
      kv: stores.kv,
      // Nothing here runs on a clock.
      jobs: false,
      // What a board's keys are signed with — through `ctx.sign`, so the board code never holds it.
      signingSecret: stores.signingSecret,
      onRun: createRunLogger(consoleLogger),
      onReject: createRejectLogger(consoleLogger)
    },
    /**
     * How a message reaches every page on its topic: in memory for one process; for replicas, Redis — a cursor moved by
     * somebody whose page is connected to one replica is drawn on a page connected to another.
     */
    realtime: {
      pubsub: stores.pubsub,
      /**
       * A socket per page rather than a stream and a request per message: twenty cursor updates a second from every
       * person on a board are frames on a connection that is already open, not twenty requests. A page falls back to
       * the stream by itself where a socket cannot open (behind HTTP/2, or a proxy that drops upgrades).
       */
      transport: 'websocket'
    }
  },
  { preAuth: [runtime.stage] }
);

server.listen(PORT, HOST);
closeOnSignals(server, {
  afterClose: async () => {
    await runtime.close();
    await stores.close();
  }
});

console.log(`[whiteboard] the boards on http://127.0.0.1:${String(PORT)}/ — ${stores.describe}`);
console.log('[whiteboard] open a board in two windows — every stroke, cursor and rename reaches the other');
console.log(`[whiteboard] agents join at ${publicUrl}${AGENT_PATH} — the ✦ on a board says how`);
