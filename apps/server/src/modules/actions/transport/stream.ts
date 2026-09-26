import { openEventStream } from '../../../core/http/sse';

import type { RawResponse } from '../../../helpers/buildResponseHelpers';
import type { ActionStreamFrame } from '@plitzi/sdk-shared';

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

/**
 * Opens a run's Server-Sent Events response.
 *
 * The run's id travels on the response head rather than in a frame: a streaming step returns as soon as the stream
 * OPENS — that is what makes it a stream — so anything it learns from a frame arrives after the flow has already
 * carried on. The head is the one place a caller can read the id in time to cancel the run it just started.
 */
export const openStream = (raw: RawResponse, onAbort: () => void, runId: string): ActionStream => {
  const stream = openEventStream(raw, { onAbort, headers: { 'X-Plitzi-Run-Id': runId }, retryMs: RETRY_MS });

  return { send: frame => stream.send(frame.event, frame.data), close: stream.close, isOpen: stream.isOpen };
};

/** Whether this caller asked for a stream. The negotiation is the client's, so a page that cannot read one never
 *  gets one by accident. */
export const wantsStream = (accept: string | string[] | undefined): boolean => {
  const value = Array.isArray(accept) ? accept.join(',') : (accept ?? '');

  return value.includes('text/event-stream');
};
