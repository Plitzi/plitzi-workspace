import { serverLog } from '../../helpers/serverLog';

import type { PrimaryServer } from '../transports';
import type { Duplex } from 'node:stream';

/**
 * How long a server shutting down lets what it is answering finish before it cuts it: a render, an upload, an action
 * called a moment ago. Well under the 30 seconds a cluster gives a pod between SIGTERM and SIGKILL.
 */
export const SHUTDOWN_GRACE_MS = 10_000;

/** A WebSocket close frame, as a server sends it (unmasked): status 1001, "going away". */
const GOING_AWAY = Buffer.from([0x88, 0x02, 0x03, 0xe9]);

/** What of a response a shutdown reads: whether it is an event stream, and how to end it. */
type Answering = { getHeader: (name: string) => unknown; end: (done?: () => void) => unknown };

/** What of the request a shutdown reads: how it asked to be answered. */
type Asking = { method?: string; headers: Record<string, string | string[] | undefined> };

/**
 * Whether a response is an event stream: said by its content type — or, since headers written with `writeHead(status,
 * headers)` are not kept where `getHeader` looks, by what it answers: a GET that asked for one, as an EventSource and
 * an MCP client's listening stream do.
 */
const isEventStream = (asking: Asking, answering: Answering): boolean => {
  const type = answering.getHeader('content-type');
  const accept = asking.headers.accept;

  return (
    (typeof type === 'string' && type.startsWith('text/event-stream')) ||
    (asking.method === 'GET' && [accept].flat().some(value => value?.includes('text/event-stream')))
  );
};

/**
 * The connections a server holds, watched from the moment it is built, so it can be shut down.
 *
 * Node's `server.close()` stops taking connections and then waits for every open one to end. A request ends; a
 * WebSocket or an event stream does not — a board open in a tab, an agent's app listening — so a server with one open
 * waited for ever, and a Ctrl+C or a SIGTERM hung until something killed it. `drain` stops taking connections, closes
 * the idle ones, ends every event stream and WebSocket at once (neither has anything left to finish), gives what is
 * still being answered `graceMs`, and then cuts what remains.
 */
export const watchConnections = (server: PrimaryServer) => {
  const sockets = new Set<Duplex>();
  const answering = new Map<Answering, Asking>();
  let draining = false;
  const closeIdle = (): void => {
    if ('closeIdleConnections' in server) {
      server.closeIdleConnections();
    }
  };
  server.on('connection', (socket: Duplex) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  const websockets = new Set<Duplex>();
  server.on('upgrade', (request: Asking, socket: Duplex) => {
    if ([request.headers.upgrade].flat().some(value => value?.toLowerCase() === 'websocket')) {
      websockets.add(socket);
      socket.once('close', () => websockets.delete(socket));
    }
  });
  server.on(
    'request',
    (request: Asking, response: Answering & { once: (event: 'close', done: () => void) => unknown }) => {
      answering.set(response, request);
      response.once('close', () => {
        answering.delete(response);
        // Node keeps a closing server's connections alive like any other: one whose answer just finished would sit
        // idle until the client let it go — undici holds one for 3 s — and the shutdown with it.
        if (draining) {
          closeIdle();
        }
      });
    }
  );

  return {
    drain: (label: string, graceMs = SHUTDOWN_GRACE_MS): Promise<void> =>
      new Promise((resolve, reject) => {
        draining = true;
        const cut = setTimeout(() => {
          if (sockets.size) {
            serverLog.warn(label, `${sockets.size} connection(s) still open after ${graceMs} ms: closing them`);
          }

          sockets.forEach(socket => socket.destroy());
        }, graceMs);
        cut.unref();

        server.close(error => {
          clearTimeout(cut);
          // ERR_SERVER_NOT_RUNNING is the state a shutdown is trying to reach, so it is not a failure: it shows up when
          // the bind has not completed yet (a signal during startup) or when the transport was already closed.
          if (error && !('code' in error && error.code === 'ERR_SERVER_NOT_RUNNING')) {
            reject(error);

            return;
          }

          resolve();
        });
        // A keep-alive connection with nothing being answered on it is closed now; one that is, once it is idle.
        closeIdle();

        answering.forEach((request, response) => {
          if (isEventStream(request, response)) {
            response.end(closeIdle);
          }
        });
        // A WebSocket, like an event stream, has nothing left to finish: it is told the server is going away (1001)
        // and closed, rather than held for the whole grace — the ten seconds a `--watch` restart waited on a page left
        // open. Its client reconnects to the server that comes up next.
        websockets.forEach(socket => socket.end(GOING_AWAY));
      })
  };
};
