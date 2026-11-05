import type { PubSubAdapter } from '@plitzi/sdk-shared';

/**
 * The two Redis connections pub/sub needs, by shape — `ioredis` fits as it is, and so does anything answering the same
 * calls. A connection in subscriber mode can do nothing else, which is why it is a second one.
 */
export type RedisPubSubClients = {
  publisher: { publish: (channel: string, message: string) => Promise<unknown> };
  subscriber: {
    subscribe: (channel: string) => Promise<unknown>;
    unsubscribe: (channel: string) => Promise<unknown>;
    on: (event: 'message', listener: (channel: string, message: string) => void) => unknown;
  };
  /** Prefixed onto every channel, so the realtime topics cannot collide with anything else on the server. */
  prefix?: string;
};

/**
 * Pub/sub over Redis: what a deployment of several replicas hands `createServer({ realtime: { pubsub } })`.
 *
 * One Redis subscription per topic per process, however many pages of that process listen to it: the listeners are
 * kept here, and the channel is subscribed on the first and unsubscribed with the last.
 */
export const createRedisPubSub = ({
  publisher,
  subscriber,
  prefix = 'plitzi:rt:'
}: RedisPubSubClients): PubSubAdapter => {
  const listeners = new Map<string, Set<(message: string) => void>>();

  subscriber.on('message', (channel, message) => {
    if (!channel.startsWith(prefix)) {
      return;
    }

    listeners.get(channel.slice(prefix.length))?.forEach(listener => listener(message));
  });

  return {
    publish: async (topic, message) => {
      await publisher.publish(`${prefix}${topic}`, message);
    },
    subscribe: async (topic, listener) => {
      const set = listeners.get(topic) ?? new Set();
      if (!set.size) {
        listeners.set(topic, set);
        await subscriber.subscribe(`${prefix}${topic}`);
      }

      set.add(listener);

      return async () => {
        set.delete(listener);
        if (!set.size) {
          listeners.delete(topic);
          await subscriber.unsubscribe(`${prefix}${topic}`);
        }
      };
    }
  };
};
