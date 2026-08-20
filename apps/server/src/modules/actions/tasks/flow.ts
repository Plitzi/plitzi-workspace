import type { ActionTask } from '../types';

const MAX_DELAY_MS = 5000;

/**
 * Pauses the flow.
 *
 * Capped hard: a run holds a connection and a concurrency slot for its whole life, so an authored `delay` is a way
 * to spend both on nothing. Anything longer than this is a schedule, not a step.
 */
const delay: ActionTask<{ milliseconds: string | number }> = {
  namespace: 'flow',
  action: 'delay',
  title: 'Delay',
  params: {
    milliseconds: { type: 'text', canBind: true, defaultValue: '1000', label: 'Milliseconds' }
  },
  run: async ({ milliseconds }, ctx) => {
    const parsed = typeof milliseconds === 'number' ? milliseconds : Number.parseInt(milliseconds, 10);
    const waitMs = Math.min(Number.isNaN(parsed) || parsed < 0 ? 0 : parsed, MAX_DELAY_MS);

    await new Promise<void>(resolve => {
      const timer = setTimeout(resolve, waitMs);
      // A cancelled run must not keep the slot for the rest of the delay: the abort resolves the wait immediately.
      ctx.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        resolve();
      });
    });

    return { waited: waitMs };
  }
};

/** Ends the run as failed, on purpose. The message reaches the trace, never the caller. */
const fail: ActionTask<{ message: string }> = {
  namespace: 'flow',
  action: 'fail',
  title: 'Fail',
  params: {
    message: { type: 'text', canBind: true, defaultValue: '', label: 'Message' }
  },
  run: ({ message }) => {
    throw new Error(message || 'Action failed');
  }
};

/**
 * Declares what the caller gets back.
 *
 * The flow scope is not the answer: it holds every node's raw result, including whatever a fetch happened to
 * return. This is the one node that decides what leaves the server, and the runner validates its keys against the
 * document's declared `output` — a key nobody declared is dropped rather than returned.
 */
const returnValues: ActionTask<{ values: string }> = {
  namespace: 'flow',
  action: 'return',
  title: 'Return',
  params: {
    values: { type: 'codemirror-json', canBind: true, defaultValue: '{}', label: 'Values' }
  },
  run: ({ values }) => {
    if (typeof values !== 'string') {
      return values;
    }

    try {
      return JSON.parse(values) as unknown;
    } catch {
      throw new Error('Return values are not valid JSON');
    }
  }
};

export const flowTasks = [delay, fail, returnValues] as ActionTask<Record<string, unknown>>[];
