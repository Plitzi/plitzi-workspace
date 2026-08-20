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

/**
 * Opens a Server-Sent Events response.
 *
 * Written straight to the RAW response, never through the response helpers: those compress the body, set a
 * Content-Length and end it in one go, which is precisely what a stream cannot do. `no-transform` says the same
 * thing to every proxy in between, and `X-Accel-Buffering: no` says it to nginx, which otherwise holds frames
 * until its buffer fills and turns a live stream into one late burst.
 */
export const openStream = (raw: RawResponse, onAbort: () => void): ActionStream => {
  let open = true;
  raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
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
