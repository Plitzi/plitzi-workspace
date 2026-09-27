import { serverLog } from '../../helpers/serverLog';

import type { PrimaryServer } from '../transports';
import type { Duplex } from 'node:stream';

/**
 * How long a server shutting down lets what it is answering finish before it cuts it: a render, an upload, an action
 * called a moment ago. Well under the 30 seconds a cluster gives a pod between SIGTERM and SIGKILL.
 */
export const SHUTDOWN_GRACE_MS = 10_000;

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
 * the idle ones, ends every event stream at once (a stream has nothing left to finish), gives what is still being
 * answered `graceMs`, and then cuts what remains.
 */
export const watchConnections = (server: PrimaryServer) => {
  const sockets = new Set<Duplex>();
  const answering = new Map<Answering, Asking>();
  server.on('connection', (socket: Duplex) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  server.on(
    'request',
    (request: Asking, response: Answering & { once: (event: 'close', done: () => void) => unknown }) => {
      answering.set(response, request);
      response.once('close', () => answering.delete(response));
    }
  );

  return {
    drain: (label: string, graceMs = SHUTDOWN_GRACE_MS): Promise<void> =>
      new Promise((resolve, reject) => {
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
        const closeIdle = (): void => {
          if ('closeIdleConnections' in server) {
            server.closeIdleConnections();
          }
        };
        closeIdle();

        answering.forEach((request, response) => {
          if (isEventStream(request, response)) {
            response.end(closeIdle);
          }
        });
      })
  };
};
