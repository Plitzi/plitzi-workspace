import type { ActionRunStep } from '@plitzi/sdk-shared';

/**
 * Delivering a call to the server, when there may be nothing there to run it.
 *
 * Asked of the worker first, as always. When no worker answered — the request never reached one, or the proxy in front
 * found none (502, 503) — the call is handed to the page server, which serves this page's host whatever the workers do,
 * to keep in the queue (`/_plitzi/queued`). A worker whose runner is away keeps it the same way, answering 202. Either
 * way the page waits for it — saying so — and reads its answer once it ran, as it would have read it then.
 */

/** Where the page server keeps a call nothing could run — on this page's own host. */
export const QUEUED_CALLS_PATH = '/_plitzi/queued';

const TICKET_HEADER = 'x-plitzi-ticket';

/** How often a kept call is asked after, at first and at most: a restart is seconds, an outage longer. */
const FIRST_WAIT_MS = 2000;
const LONGEST_WAIT_MS = 15_000;

/** What the action endpoint answers a call — as it writes it, the one shape every mode reads. */
export type ActionResponse = {
  runId?: string;
  status?: string;
  output?: Record<string, unknown>;
  error?: string;
  /** The refusal's code, when its step gave one (`refuse('banned', …)`): what a flow branches on, never the words. */
  code?: string;
  reason?: string;
  /** What the flow did, step by step. Sent to any page whose debugging the deployment authorizes. */
  steps?: ActionRunStep[];
  /** The steps WITH what each read and answered. Only ever sent to an authoring request or by a dev server. */
  trace?: Record<string, unknown>[];
};

/** How a call ended: answered (by the server, now or once it ran), or never answered by anything. */
export type Delivery = { status: number; payload: ActionResponse } | { unreachable: unknown };

type Receipt = { jobId: string; ticket: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const receiptOf = (status: number, payload: unknown): Receipt | undefined =>
  status === 202 &&
  isRecord(payload) &&
  payload.status === 'queued' &&
  typeof payload.jobId === 'string' &&
  typeof payload.ticket === 'string'
    ? { jobId: payload.jobId, ticket: payload.ticket }
    : undefined;

// The endpoint's own answer, read as it writes it — the shape above; the page only ever reads its fields back out.
const answerOf = (value: unknown): ActionResponse => (isRecord(value) ? value : {});

/**
 * A key no other call has, for a call handed to the page server: asked again — its answer lost on the way back — it is
 * the same call kept, never a second one. Not sent to the worker, whose own single-flight keeps a double click one run.
 */
const freshKey = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  return `kept-${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`;
};

const pause = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('The call was stopped'));

      return;
    }

    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('The call was stopped'));
      },
      { once: true }
    );
  });

const post = async (url: string, body: string, signal: AbortSignal, keepalive: boolean) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    signal,
    keepalive,
    body
  });

  return { status: response.status, payload: answerOf(await response.json().catch(() => ({}))) };
};

/**
 * Asks after a kept call until it ran: waiting longer each time, never giving up while the page is open — the call runs
 * whether or not anybody is still here to read it. A gone call (404) is said as failed.
 */
const waitFor = async (receipt: Receipt, signal: AbortSignal): Promise<Delivery> => {
  let wait = FIRST_WAIT_MS;
  for (;;) {
    await pause(wait, signal);
    wait = Math.min(LONGEST_WAIT_MS, Math.round(wait * 1.5));
    try {
      const response = await fetch(`${QUEUED_CALLS_PATH}/${encodeURIComponent(receipt.jobId)}`, {
        headers: { [TICKET_HEADER]: receipt.ticket },
        credentials: 'include',
        signal
      });
      const read = answerOf(await response.json().catch(() => ({})));
      if (response.status === 404) {
        return { status: 404, payload: { ...read, status: 'failed', reason: 'not_found' } };
      }

      if (response.ok && (read.status === 'completed' || read.status === 'failed')) {
        return { status: 200, payload: read };
      }
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }
      // The page server itself away a moment: asked again on the next turn.
    }
  }
};

export const deliverCall = async ({
  endpoint,
  call,
  signal,
  keepalive = false,
  onQueued
}: {
  endpoint: string;
  call: { actionId: string; input: Record<string, unknown>; idempotencyKey?: string };
  signal: AbortSignal;
  /** For a detached call, so a navigation right after it does not cancel the request. */
  keepalive?: boolean;
  /** Told when the call is kept, before it is waited for: what puts it on the page as waiting. */
  onQueued: () => void;
}): Promise<Delivery> => {
  let answered: { status: number; payload: ActionResponse } | undefined;
  try {
    answered = await post(endpoint, JSON.stringify(call), signal, keepalive);
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }
  }

  if (!answered || answered.status === 502 || answered.status === 503) {
    const unanswered = answered;
    try {
      const kept = await post(
        QUEUED_CALLS_PATH,
        JSON.stringify({ ...call, idempotencyKey: call.idempotencyKey || freshKey() }),
        signal,
        keepalive
      );
      // A page server that keeps no calls (404) leaves it as it was: nothing could run it.
      if (kept.status === 404) {
        return unanswered ?? { unreachable: new Error('No worker answered, and this server keeps no calls for later') };
      }

      answered = kept;
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }

      return unanswered ?? { unreachable: error };
    }
  }

  const receipt = receiptOf(answered.status, answered.payload);
  if (!receipt) {
    return answered;
  }

  onQueued();

  return waitFor(receipt, signal);
};
