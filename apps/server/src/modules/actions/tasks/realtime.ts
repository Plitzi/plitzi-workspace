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

export const realtimeTasks = [publish] as ActionTask<Record<string, unknown>>[];
