import { DEFAULT_GRANT_SECONDS, MAX_GRANT_SECONDS } from '../../realtime/grants';

import type { ActionTask } from '../types';

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
  description: 'Sends a message to every page subscribed to a topic of one of the space’s channels.',
  params: {
    topic: { type: 'text', canBind: true, defaultValue: '', label: 'Topic (board:{{ input.board }})' },
    type: { type: 'text', canBind: true, defaultValue: '', label: 'Type' },
    data: { type: 'codemirror-json', canBind: true, defaultValue: '{}', label: 'Data' }
  },
  run: async ({ topic, type, data }, ctx) => {
    if (!ctx.publish) {
      throw new Error('This server has no realtime channels');
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
      throw new Error('This server has no realtime channels');
    }

    const seconds = ttlSeconds === '' ? undefined : Number(ttlSeconds);

    return { topic, grant: await ctx.grant(topic, Number.isFinite(seconds) ? seconds : undefined) };
  }
};

export const realtimeTasks = [publish, grant] as ActionTask<Record<string, unknown>>[];
