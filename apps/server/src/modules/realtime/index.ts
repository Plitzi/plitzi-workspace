import { matchChannel } from '@plitzi/sdk-shared/realtime';

import { createChannelResolver } from './declarations';
import { createRealtimeHub } from './hub';
import { createMemoryPubSub } from './memoryPubSub';

import type { ChannelResolver } from './declarations';
import type { RealtimeHub } from './hub';
import type { SSRServerConfig } from '@plitzi/sdk-shared';

export { createMemoryPubSub } from './memoryPubSub';
export { handleRealtimePublish, handleRealtimeSubscribe } from './handlers';

/** A type a flow publishes: its own vocabulary — the `$` types are the channel's. */
const SERVER_TYPE = /^[A-Za-z0-9_.:-]{1,64}$/;

export type RealtimeModule = {
  hub: RealtimeHub;
  path: string;
  resolveChannels: ChannelResolver;
  /**
   * Publishes from the server — what a flow's `realtime.publish` does. Checked against the space's channels like a
   * page's publish, and sent `from: 'server'`: the one sender a page cannot be.
   */
  publish: (
    space: { spaceId: number; environment: string },
    topic: string,
    type: string,
    data: unknown
  ) => Promise<void>;
};

const modules = new WeakMap<object, RealtimeModule>();

/**
 * The server's realtime channels, built once per config — or `undefined` when they are off or cannot be: without the
 * space's documents (`getOfflineData`) there is nothing to say which channels a space declares, so none is opened.
 */
export const realtimeModuleFor = (config: SSRServerConfig): RealtimeModule | undefined => {
  const getOfflineData = config.adapters.getOfflineData;
  if (config.realtime === false || !getOfflineData) {
    return undefined;
  }

  const existing = modules.get(config);
  if (existing) {
    return existing;
  }

  const hub = createRealtimeHub(config.realtime?.pubsub ?? createMemoryPubSub());
  const resolveChannels = createChannelResolver(getOfflineData);
  const module: RealtimeModule = {
    hub,
    path: config.realtime?.path ?? '/_realtime',
    resolveChannels,
    publish: async (space, topic, type, data) => {
      const channels = await resolveChannels(space.spaceId, space.environment);
      if (!matchChannel(topic, channels)) {
        throw new Error(`No channel of this space matches "${topic}": declare it in the space's \`channels\``);
      }

      if (!SERVER_TYPE.test(type)) {
        throw new Error('A message type is 1-64 of A-Z a-z 0-9 _ . : -');
      }

      await hub.publish(space, { topic, type, data, from: 'server', at: Date.now() });
    }
  };
  modules.set(config, module);

  return module;
};
