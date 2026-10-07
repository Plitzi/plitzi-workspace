import { warnRealtime } from './failure';
import { admit, answer, connectionFor, publishFrom } from './handlers';
import { requestOrigin } from '../../core/requestParser';
import { frameText } from '../../helpers/wsFrame';

import type { ChannelResolver } from './declarations';
import type { RealtimeGrants } from './grants';
import type { RealtimeAnswer } from './handlers';
import type { RealtimeHub } from './hub';
import type { UpgradeRequest } from '../../core/http/socketResponse';
import type { SSRRequest, SSRResponseHelpers } from '@plitzi/sdk-shared';
import type { IncomingMessage } from 'node:http';
import type { RawData, WebSocket, WebSocketServer } from 'ws';

/** The largest frame a page may send: well above the largest message a channel may declare, and bounded. */
const MAX_FRAME_BYTES = 256 * 1024;

/**
 * What may wait in a socket's buffer for a page that stopped reading. Past it the page is gone in all but name, and
 * holding everything it has not read is how one stalled tab grows a process.
 */
const MAX_BUFFERED_BYTES = 1024 * 1024;

/** How often the server asks a socket whether the page behind it is still there — and gives up on one that did not answer the last time. */
const PING_MS = 25_000;

let server: Promise<WebSocketServer> | undefined;

/**
 * Loaded the first time a page asks for a socket: a server whose pages never do — or that runs behind HTTP/2, where
 * none can — never pays for the module.
 */
const socketServer = (): Promise<WebSocketServer> =>
  (server ??= import('ws').then(
    ({ WebSocketServer: Server }) => new Server({ noServer: true, maxPayload: MAX_FRAME_BYTES })
  ));

/**
 * A browser opens a WebSocket to any address, carrying that address's cookies, from any page — CORS does not apply to
 * it. So a socket is refused unless the page that opened it is on this origin, or on one the deployment lists: without
 * this, another site could open a channel restricted to signed-in visitors with a visitor's session and read it.
 * A client that is not a browser sends no `Origin`, and has no visitor's cookies to borrow.
 */
const originAllowed = (raw: IncomingMessage, req: SSRRequest, allowed: readonly string[]): boolean => {
  const origin = raw.headers.origin;

  return origin === undefined || origin === requestOrigin(req) || allowed.includes(origin);
};

type Incoming = { id?: unknown; topic?: unknown; type?: unknown; data?: unknown };

/** A frame's text, whichever of the shapes `ws` hands a frame over in. */
const parse = (frame: RawData): Incoming | undefined => {
  try {
    const value: unknown = JSON.parse(frameText(frame));

    return typeof value === 'object' && value !== null ? value : undefined;
  } catch {
    return undefined;
  }
};

/** A publish's id, echoed on its `ack`: what the page matches the answer to. Short, and never anything else. */
const ackId = (id: unknown): number | string | undefined =>
  (typeof id === 'number' && Number.isInteger(id)) || (typeof id === 'string' && id.length <= 64) ? id : undefined;

export type SocketDeps = {
  req: SSRRequest;
  res: SSRResponseHelpers;
  raw: IncomingMessage;
  upgrade: UpgradeRequest;
  hub: RealtimeHub;
  resolveChannels: ChannelResolver;
  grants: RealtimeGrants;
  allowedOrigins: readonly string[];
};

/**
 * A page's realtime connection as a WebSocket: the same topics, rules and messages as the Server-Sent Events one, in
 * both directions over one socket. A publish is a frame, not a request — no headers, no second connection, no token
 * to present: the socket is the credential. Its answer arrives as an `ack` carrying the publish's `id`.
 *
 * Refused the way the stream is — a `403` or a `422`, in HTTP, before anything switches — so a page falls back or
 * reports it exactly as it would there.
 */
export const handleRealtimeSocket = async ({
  req,
  res,
  raw,
  upgrade,
  hub,
  resolveChannels,
  grants,
  allowedOrigins
}: SocketDeps): Promise<void> => {
  if (!originAllowed(raw, req, allowedOrigins)) {
    answer(res, { status: 403, error: 'A page on another site may not open this', reason: 'foreign' });

    return;
  }

  const admission = await admit(req, resolveChannels, grants);
  if (!admission.ok) {
    answer(res, admission.answer);

    return;
  }

  const sockets = await socketServer();
  upgrade.taken = true;
  // For the access log: the request was answered by switching, not by a response.
  res.setStatus(101);
  sockets.handleUpgrade(raw, upgrade.socket, upgrade.head, (socket: WebSocket) => {
    const send = (event: string, data: unknown): void => {
      if (socket.readyState !== socket.OPEN) {
        return;
      }

      if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
        socket.terminate();

        return;
      }

      socket.send(JSON.stringify({ event, data }));
    };
    // 1001, going away: what a page hears when the server shuts down, and reconnects from once it is back.
    const connection = connectionFor(admission, send, () => socket.close(1001, 'The server is going away'));

    let alive = true;
    const heartbeat = setInterval(() => {
      if (!alive) {
        socket.terminate();

        return;
      }

      alive = false;
      socket.ping();
    }, PING_MS);
    socket.on('pong', () => {
      alive = true;
    });

    socket.on('message', (frame, binary) => {
      alive = true;
      const message = binary ? undefined : parse(frame);
      if (!message) {
        return;
      }

      const id = ackId(message.id);
      void publishFrom(hub, connection, message)
        .catch((error: unknown): RealtimeAnswer => {
          warnRealtime('a message was not delivered')(error);

          return { status: 503, error: 'The message was not delivered: send it again', reason: 'unavailable' };
        })
        .then(result => {
          if (id !== undefined) {
            send('ack', {
              id,
              ok: result.status === 204,
              status: result.status,
              ...(result.reason ? { reason: result.reason } : {})
            });
          }
        });
    });

    socket.on('close', () => {
      clearInterval(heartbeat);
      hub.disconnect(connection).catch(warnRealtime('a connection was not let go'));
    });
    // An error is followed by `close`, which is where the connection is let go.
    socket.on('error', () => socket.terminate());

    send('ready', { connection: connection.id, topics: [...admission.accepted.keys()], refused: admission.refused });
    hub.connect(connection).catch(warnRealtime('a connection was not announced'));
  });
};
