import type { RawResponse } from '../../../helpers/buildResponseHelpers';
import type { ActionStreamFrame } from '@plitzi/sdk-shared';

/** How often a comment frame goes out. Short enough that a dead peer is noticed in seconds, long enough that an
 *  idle stream costs nothing worth counting. */
const HEARTBEAT_MS = 15_000;

/**
 * How long a hand-rolled `EventSource` waits before reconnecting, if one ever gets here.
 *
 * A day, deliberately. `EventSource` reconnects whenever a stream ends — INCLUDING on normal completion — so a
 * client using it would start a fresh run every time one finished, forever. Our own client uses `fetch` and a
 * reader for exactly this reason; this value is what stops somebody else's from becoming a loop.
 */
const RETRY_MS = 86_400_000;

/**
 * How much unread body may pile up before the run is stopped.
 *
 * A `write` that answers `false` has been buffered rather than sent, which is normal for a moment and a leak
 * forever: a peer that stopped reading — a phone that slept, a proxy that wedged — otherwise has the whole run's
 * output accumulated for it in memory. The socket says nothing, so the only signal is this one.
 */
const MAX_BUFFERED_BYTES = 1_000_000;

export type ActionStream = {
  /** Sends one frame. Silently drops once the socket is gone — a stream writing into a closed peer is not an error
   *  worth failing a run over. */
  send: (frame: ActionStreamFrame) => void;
  /** Ends the stream and stops the heartbeat. */
  close: () => void;
  /** Whether the peer is still there. */
  isOpen: () => boolean;
};

const encode = (frame: ActionStreamFrame): string => `event: ${frame.event}\ndata: ${JSON.stringify(frame.data)}\n\n`;

/** What the host has written but not yet handed to the socket. Node's own response reports it; the minimum raw
 *  response this server accepts does not have to, and a host that cannot say simply never trips the cap. */
const bufferedBytes = (raw: RawResponse): number => {
  const { writableLength } = raw as RawResponse & { writableLength?: number };

  return typeof writableLength === 'number' ? writableLength : 0;
};

/**
 * Opens a Server-Sent Events response.
 *
 * Written straight to the RAW response, never through the response helpers: those compress the body, set a
 * Content-Length and end it in one go, which is precisely what a stream cannot do. `no-transform` says the same
 * thing to every proxy in between, and `X-Accel-Buffering: no` says it to nginx, which otherwise holds frames
 * until its buffer fills and turns a live stream into one late burst.
 */
export const openStream = (raw: RawResponse, onAbort: () => void, runId: string): ActionStream => {
  let open = true;
  raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    /**
     * The run's id, on the response head rather than in a frame.
     *
     * A streaming step returns as soon as the stream OPENS — that is what makes it a stream — so anything it
     * learns from a frame arrives after the flow has already carried on. The head is the one place a caller can
     * read the id in time to cancel the run it just started.
     */
    'X-Plitzi-Run-Id': runId
  });
  raw.write(`retry: ${RETRY_MS}\n\n`);

  const heartbeat = setInterval(() => {
    if (!open) {
      return;
    }

    try {
      // A comment frame: it keeps proxies from timing the connection out, and it is the write that FAILS when the
      // peer is gone without the socket having told us — which is how a run for nobody gets stopped.
      raw.write(': ping\n\n');
    } catch {
      open = false;
      clearInterval(heartbeat);
      onAbort();
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
    send: frame => {
      if (!open) {
        return;
      }

      try {
        raw.write(encode(frame));
        // Not an error and not a reason to stop on its own — one slow read is ordinary. Past the cap it is a peer
        // that is not reading at all, and the run is producing output for nobody.
        if (bufferedBytes(raw) > MAX_BUFFERED_BYTES) {
          open = false;
          clearInterval(heartbeat);
          onAbort();
          try {
            raw.end();
          } catch {
            // Already gone, which is the case this branch exists for.
          }
        }
      } catch {
        open = false;
        clearInterval(heartbeat);
        onAbort();
      }
    },
    close,
    isOpen: () => open
  };
};

/** Whether this caller asked for a stream. The negotiation is the client's, so a page that cannot read one never
 *  gets one by accident. */
export const wantsStream = (accept: string | string[] | undefined): boolean => {
  const value = Array.isArray(accept) ? accept.join(',') : (accept ?? '');

  return value.includes('text/event-stream');
};
