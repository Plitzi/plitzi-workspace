import { broadcast, channelName, onBroadcast } from '../../core/server/fleet/link';

import type { PubSubAdapter } from '@plitzi/sdk-shared';

type Listener = (message: string) => void;

const isRelayed = (value: unknown): value is { topic: string; message: string } =>
  typeof value === 'object' &&
  value !== null &&
  'topic' in value &&
  typeof value.topic === 'string' &&
  'message' in value &&
  typeof value.message === 'string';

/**
 * The default pub/sub: in this process, and across its workers.
 *
 * A page connected to one worker must hear what another worker published, so a publish is delivered here AND sent to
 * the rest of the fleet as a broadcast, which each process delivers to its own listeners. Without workers the
 * broadcast goes nowhere and this is a Map of listeners. A second REPLICA shares nothing with this one: a deployment
 * that runs several hands the server an adapter over something shared (Redis, NATS…).
 */
export const createMemoryPubSub = (): PubSubAdapter => {
  const topics = new Map<string, Set<Listener>>();
  const fleet = channelName('realtime.pubsub');

  const deliver = (topic: string, message: string): void => {
    for (const listener of topics.get(topic) ?? []) {
      listener(message);
    }
  };

  onBroadcast(fleet, payload => {
    if (isRelayed(payload)) {
      deliver(payload.topic, payload.message);
    }
  });

  return {
    publish: (topic, message) => {
      deliver(topic, message);
      broadcast(fleet, { topic, message });

      return Promise.resolve();
    },
    subscribe: (topic, listener) => {
      const listeners = topics.get(topic) ?? new Set<Listener>();
      listeners.add(listener);
      topics.set(topic, listeners);

      return Promise.resolve(() => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          topics.delete(topic);
        }

        return Promise.resolve();
      });
    }
  };
};
