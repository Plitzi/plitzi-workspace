import { DEFAULT_GRANT_SECONDS, MAX_GRANT_SECONDS } from '../../realtime/grants';

import type { ActionTask } from '../types';

export const NO_REALTIME =
  "This runner has no realtime channels: one made with `createActionsModule` publishes when it is given `realtime: createActionRealtime({ getOfflineData, pubsub, kv })`, with the page servers' own pubsub and kv";

const parse = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

/**
 * Says something on one of the space's realtime channels — what an action does after it saved, so everyone looking
 * sees what was saved. The only way in on a channel declared `publish: 'server'`.
 */
const publish: ActionTask<{ topic: string; type: string; data: unknown }> = {
  namespace: 'realtime',
  action: 'publish',
  title: 'Publish On Channel',
  description:
    'Sends a message to every page subscribed to a topic of one of the space’s channels. On a `retain: true` channel ' +
    'it is also kept, the latest of its type, for every page that joins later; `null` data forgets it.',
  params: {
    topic: { type: 'text', canBind: true, defaultValue: '', label: 'Topic (board:{{ input.board }})' },
    type: { type: 'text', canBind: true, defaultValue: '', label: 'Type' },
    data: { type: 'codemirror-json', canBind: true, defaultValue: '{}', label: 'Data' }
  },
  run: async ({ topic, type, data }, ctx) => {
    if (!ctx.publish) {
      throw new Error(NO_REALTIME);
    }

    await ctx.publish(topic, type, parse(data));

    return { topic, published: true };
  }
};

/**
 * Lets the visitor into one topic of a channel declared `grant: true`: answers the grant their page opens it with
 * (the `channel` element's `grant`, `useChannel`'s `{ grant }`). The flow decides who is in BEFORE this step — a
 * password checked, an invitation, the order's owner — and a page that never ran it cannot subscribe, however well
 * it knows the topic's name.
 */
const grant: ActionTask<{ topic: string; ttlSeconds: string | number }> = {
  namespace: 'realtime',
  action: 'grant',
  title: 'Grant Channel',
  description: 'Answers a grant that lets this visitor’s page open one topic of a private (`grant: true`) channel.',
  params: {
    topic: { type: 'text', canBind: true, defaultValue: '', label: 'Topic (room:{{ input.room }})' },
    ttlSeconds: {
      type: 'text',
      canBind: true,
      defaultValue: String(DEFAULT_GRANT_SECONDS),
      label: `For how long (seconds, at most ${String(MAX_GRANT_SECONDS)})`
    }
  },
  run: async ({ topic, ttlSeconds }, ctx) => {
    if (!ctx.grant) {
      throw new Error(NO_REALTIME);
    }

    const seconds = ttlSeconds === '' ? undefined : Number(ttlSeconds);

    return { topic, grant: await ctx.grant(topic, Number.isFinite(seconds) ? seconds : undefined) };
  }
};

/**
 * Takes back what `realtime.grant` gave: the grant named — one person out of a room — or, naming none, every grant for
 * the topic, the ones in use and the ones not used yet. Whoever is on the topic with one is let go of it at once
 * (`$revoked`), on every replica; getting back in takes a new grant from the action that decides who may.
 */
const revoke: ActionTask<{ topic: string; grant: string }> = {
  namespace: 'realtime',
  action: 'revoke',
  title: 'Revoke Channel Grant',
  description:
    'Takes back one grant to a private channel’s topic — or all of them — and lets go whoever is on it with one.',
  params: {
    topic: { type: 'text', canBind: true, defaultValue: '', label: 'Topic (room:{{ input.room }})' },
    grant: { type: 'text', canBind: true, defaultValue: '', label: 'Grant (empty = every grant for the topic)' }
  },
  run: async ({ topic, grant }, ctx) => {
    if (!ctx.revoke) {
      throw new Error(NO_REALTIME);
    }

    await ctx.revoke(topic, grant ? grant : undefined);

    return { topic, revoked: grant ? 'one' : 'all' };
  }
};

export const realtimeTasks = [publish, grant, revoke] as ActionTask<Record<string, unknown>>[];
