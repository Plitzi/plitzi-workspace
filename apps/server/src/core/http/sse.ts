import type { RawResponse } from '../../helpers/buildResponseHelpers';

/** How often a comment frame goes out. Short enough that a dead peer is noticed in seconds, long enough that an
 *  idle stream costs nothing worth counting. */
const HEARTBEAT_MS = 15_000;

/**
 * How much unread body may pile up before the stream is dropped.
 *
 * A `write` that answers `false` has been buffered rather than sent, which is normal for a moment and a leak
 * forever: a peer that stopped reading — a phone that slept, a proxy that wedged — otherwise has everything sent to
 * it accumulated in memory. The socket says nothing, so the only signal is this one.
 */
const MAX_BUFFERED_BYTES = 1_000_000;

export type EventStream = {
  /** Sends one event. Silently drops once the socket is gone — writing into a closed peer is not an error. */
  send: (event: string, data: unknown) => void;
  /** Ends the stream and stops the heartbeat. */
  close: () => void;
  /** Whether the peer is still there. */
  isOpen: () => boolean;
};

export type EventStreamOptions = {
  /** Called once when the peer is found gone — a failed write, or a peer that stopped reading. */
  onAbort: () => void;
  /** Headers besides the ones every event stream sends. */
  headers?: Record<string, string>;
  /** What an `EventSource` should wait before reconnecting, in milliseconds. */
  retryMs: number;
};

/** What the host has written but not yet handed to the socket. Node's own response reports it; the minimum raw
 *  response this server accepts does not have to, and a host that cannot say simply never trips the cap. */
const bufferedBytes = (raw: RawResponse): number => {
  const { writableLength } = raw as RawResponse & { writableLength?: number };

  return typeof writableLength === 'number' ? writableLength : 0;
};

/**
 * Opens a Server-Sent Events response — an action's progress, a realtime channel.
 *
 * Written straight to the RAW response, never through the response helpers: those compress the body, set a
 * Content-Length and end it in one go, which is precisely what a stream cannot do. `no-transform` says the same
 * thing to every proxy in between, and `X-Accel-Buffering: no` says it to nginx, which otherwise holds frames
 * until its buffer fills and turns a live stream into one late burst.
 */
export const openEventStream = (
  raw: RawResponse,
  { onAbort, headers = {}, retryMs }: EventStreamOptions
): EventStream => {
  let open = true;
  raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    ...headers
  });
  raw.write(`retry: ${retryMs}\n\n`);

  const drop = () => {
    open = false;
    clearInterval(heartbeat);
    onAbort();
  };

  const heartbeat = setInterval(() => {
    if (!open) {
      return;
    }

    try {
      // A comment frame: it keeps proxies from timing the connection out, and it is the write that FAILS when the
      // peer is gone without the socket having told us.
      raw.write(': ping\n\n');
    } catch {
      drop();
    }
  }, HEARTBEAT_MS);

  const close = () => {
    if (!open) {
      return;
    }

    open = false;
    clearInterval(heartbeat);
    try {
      raw.end();
    } catch {
      // Already closed by the peer; nothing to do.
    }
  };

  return {
    send: (event, data) => {
      if (!open) {
        return;
      }

      try {
        raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        // Not an error on its own — one slow read is ordinary. Past the cap it is a peer that is not reading at all.
        if (bufferedBytes(raw) > MAX_BUFFERED_BYTES) {
          drop();
          try {
            raw.end();
          } catch {
            // Already gone, which is the case this branch exists for.
          }
        }
      } catch {
        drop();
      }
    },
    close,
    isOpen: () => open
  };
};
