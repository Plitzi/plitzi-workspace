import { onAbort } from '../../../helpers/onAbort';
import { ActionRefusal } from '../runtime/errors';
import { countRate } from '../runtime/rateLimit';

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

/**
 * Ends the run as failed, on purpose. The message reaches the trace — and, with `tellCaller`, the caller too, as the
 * run's `error`: a guard whose reason the page should show ("that name is taken") rather than a generic failure.
 */
// `tellCaller` as a builder's picker writes it — the WORD — or as a bound value hands it over, a real boolean.
const fail: ActionTask<{ message: string; tellCaller: boolean | string }> = {
  namespace: 'flow',
  action: 'fail',
  title: 'Fail',
  params: {
    message: { type: 'text', canBind: true, defaultValue: '', label: 'Message' },
    tellCaller: { type: 'boolean', canBind: true, defaultValue: false, label: 'Tell the caller why' }
  },
  run: ({ message, tellCaller }) => {
    const text = message || 'Action failed';
    throw tellCaller === true || tellCaller === 'true' ? new ActionRefusal(text) : new Error(text);
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

/**
 * Refuses the run once a caller has asked too often — a contact form, a vote, a comment box, anything public.
 *
 * A fixed window per bucket: at most `limit` runs every `windowSeconds`, counted in the space's `kv` (shared by every
 * replica that shares it). `per: caller` gives each person their own count — the signed-in account, or the address of
 * whoever is not signed in — which is what a public action wants; `per: everyone` is one count for all of them, a
 * ceiling on the action itself. Refused with the message, which the caller sees as the run's `error`.
 */
const rateLimit: ActionTask<{
  bucket: string;
  limit: string | number;
  windowSeconds: string | number;
  per: string;
  message: string;
}> = {
  namespace: 'flow',
  action: 'rateLimit',
  title: 'Rate Limit',
  params: {
    bucket: { type: 'text', canBind: true, defaultValue: '', label: 'Name (what is counted — "comments")' },
    limit: { type: 'text', canBind: true, defaultValue: '10', label: 'At most' },
    windowSeconds: { type: 'text', canBind: true, defaultValue: '60', label: 'Every (seconds)' },
    per: {
      type: 'select',
      canBind: true,
      defaultValue: 'caller',
      label: 'Counted',
      options: [
        { label: 'For each person', value: 'caller' },
        { label: 'For everyone together', value: 'everyone' }
      ]
    },
    message: {
      type: 'text',
      canBind: true,
      defaultValue: '',
      label: 'Refusal (what the caller is told)'
    }
  },
  run: async ({ bucket, limit, windowSeconds, per, message }, ctx) => {
    const perSeconds = Number(windowSeconds);
    const { allowed, count, remaining } = await countRate(ctx.kv, ctx.callerId, bucket, {
      most: Number(limit),
      perSeconds,
      per: per === 'everyone' ? 'everyone' : 'caller'
    });
    if (!allowed) {
      throw new ActionRefusal(message || `Too many at once — try again in ${String(perSeconds)} seconds`);
    }

    return { count, remaining };
  }
};

const jsonInput = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value || '{}') as unknown;
  } catch {
    throw new Error('The input of a run set for later is JSON: `{ "room": "{{ input.room }}" }`');
  }
};

/**
 * Starts one of the space's actions in so many seconds — the turn that runs out, the bot's move, the hold that lapses —
 * by that action's `later` trigger, held by the server's job queue: it runs whether or not a page is still open. A
 * `key` names it: set again under the same key, the one still waiting is replaced (the timer of a turn a move ended);
 * `flow.cancelLater` drops it.
 */
const later: ActionTask<{ action: string; in: string | number; input: unknown; key: string }> = {
  namespace: 'flow',
  action: 'later',
  title: 'Run Later',
  description: 'Starts one of the space’s actions — one with a “later” trigger — in so many seconds, on the server.',
  params: {
    action: { type: 'text', canBind: true, defaultValue: '', label: 'Action (its identifier)' },
    in: { type: 'text', canBind: true, defaultValue: '30', label: 'In (seconds)' },
    input: { type: 'codemirror-json', canBind: true, defaultValue: '{}', label: 'Its input' },
    key: { type: 'text', canBind: true, defaultValue: '', label: 'Known as (replaces what waits under it)' }
  },
  run: async ({ action, in: seconds, input, key }, ctx) => {
    if (!ctx.later) {
      throw new Error('This server runs no jobs: nothing can be set to run later');
    }

    const given = jsonInput(input);

    return ctx.later({
      action,
      in: Number(seconds),
      input: typeof given === 'object' && given !== null && !Array.isArray(given) ? { ...given } : {},
      ...(key === '' ? {} : { key })
    });
  }
};

/** Drops what `flow.later` set under a key and is still waiting — the timer of a game that ended. */
const cancelLater: ActionTask<{ key: string }> = {
  namespace: 'flow',
  action: 'cancelLater',
  title: 'Cancel Later',
  description: 'Drops the runs set for later under a key that are still waiting.',
  params: { key: { type: 'text', canBind: true, defaultValue: '', label: 'Known as' } },
  run: async ({ key }, ctx) => {
    if (!ctx.cancelLater) {
      throw new Error('This server runs no jobs: nothing was set to run later');
    }

    return { key, cancelled: await ctx.cancelLater(key) };
  }
};

export const flowTasks = [delay, fail, output, onFailure, rateLimit, later, cancelLater] as ActionTask<
  Record<string, unknown>
>[];
export const streamTasks = [emit] as ActionTask<Record<string, unknown>>[];
