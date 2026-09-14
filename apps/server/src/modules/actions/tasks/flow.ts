import { onAbort } from '../../../helpers/onAbort';

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
      // Through `onAbort`, because a run cancelled BEFORE this step was reached would otherwise wait it out in
      // full — the listener is attached here, and by then the event it is waiting for has already happened.
      onAbort(ctx.signal, () => {
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
 * Where a flow's undo begins — read by the runner, never run as a step.
 *
 * A run that reaches it has succeeded and ends there. A run whose step failed before it jumps here instead and runs
 * the steps after it, each still asking its own `when` — the failure may have come before the thing to undo was ever
 * done — and still ends as failed, with the failure it had. What failed is in their scope as `{{ failure.step }}` and
 * `{{ failure.message }}`.
 */
const onFailure: ActionTask<Record<string, never>> = {
  namespace: 'flow',
  action: 'onFailure',
  title: 'On Failure',
  description: 'The steps after this one run only when a step before it fails, to undo what the flow already did',
  params: {},
  run: () => {
    throw new Error('On Failure marks where a failed run’s undo begins; the runner never runs it as a step');
  }
};

/**
 * Declares what the caller gets back — and IS the declaration.
 *
 * The flow scope is not the answer: it holds every node's raw result, including whatever a fetch happened to
 * return. This step is the one place that decides what leaves the server, and what it names is exactly what the
 * caller receives.
 *
 * There is no separate output contract on the document, deliberately. Declaring the shape before the steps exist
 * asks an author to know what a flow returns before writing it, and leaves two places to keep in step; the values
 * here are the contract, and the builder derives the field list from them for bindings.
 *
 * It must be the LAST step: the runner reads the last one that ran, so a step after it is work whose result
 * nobody asked for — the validator says so.
 */
const output: ActionTask<{ values: string }> = {
  namespace: 'flow',
  action: 'output',
  title: 'Output',
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
      throw new Error('Output values are not valid JSON');
    }
  }
};

/**
 * Pushes progress to a caller watching the run.
 *
 * A no-op when nobody negotiated a stream, and deliberately so: a flow is authored once and runs both ways, so a
 * step that reported progress must not fail on the request/response path just because nobody is listening.
 */
const emit: ActionTask<{ chunk: string }> = {
  namespace: 'stream',
  action: 'emit',
  title: 'Report Progress',
  params: {
    chunk: { type: 'codemirror-text', canBind: true, defaultValue: '', label: 'Chunk' }
  },
  run: ({ chunk }, ctx) => {
    ctx.emit(chunk);

    return { emitted: true };
  }
};

export const flowTasks = [delay, fail, output, onFailure] as ActionTask<Record<string, unknown>>[];
export const streamTasks = [emit] as ActionTask<Record<string, unknown>>[];
