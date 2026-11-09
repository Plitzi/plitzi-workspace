import { describe, expect, it } from 'vitest';

import { createRedisPubSub } from './redisPubSub';

/** Redis in miniature: one message bus, and the subscriber connections of the processes sharing it. */
const fakeRedis = () => {
  const connections: { channels: Set<string>; listener?: (channel: string, message: string) => void }[] = [];
  const subscribeCalls: string[] = [];
  const client = () => {
    const connection: (typeof connections)[number] = { channels: new Set() };
    connections.push(connection);

    return {
      subscribe: (channel: string) => {
        subscribeCalls.push(channel);
        connection.channels.add(channel);

        return Promise.resolve();
      },
      unsubscribe: (channel: string) => {
        connection.channels.delete(channel);

        return Promise.resolve();
      },
      on: (_event: 'message', listener: (channel: string, message: string) => void) => {
        connection.listener = listener;
      }
    };
  };
  const publisher = {
    publish: (channel: string, message: string) => {
      connections.filter(entry => entry.channels.has(channel)).forEach(entry => entry.listener?.(channel, message));

      return Promise.resolve(1);
    }
  };

  return { client, publisher, subscribeCalls };
};

describe('createRedisPubSub', () => {
  it('delivers across processes sharing one Redis, subscribing each channel once per process', async () => {
    const redis = fakeRedis();
    const first = createRedisPubSub({ publisher: redis.publisher, subscriber: redis.client() });
    const second = createRedisPubSub({ publisher: redis.publisher, subscriber: redis.client() });
    const heard: string[] = [];
    await first.subscribe('1/main/board:1', message => heard.push(`first:${message}`));
    await first.subscribe('1/main/board:1', message => heard.push(`first-again:${message}`));
    const stop = await second.subscribe('1/main/board:1', message => heard.push(`second:${message}`));

    await first.publish('1/main/board:1', 'hello');
    await stop();
    await second.publish('1/main/board:1', 'again');

    expect(heard).toEqual(['first:hello', 'first-again:hello', 'second:hello', 'first:again', 'first-again:again']);
    expect(redis.subscribeCalls).toEqual(['plitzi:rt:1/main/board:1', 'plitzi:rt:1/main/board:1']);
  });
});
