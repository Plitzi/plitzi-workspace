import { matchChannel } from '@plitzi/sdk-shared/realtime';

import { createChannelResolver } from './declarations';
import { createRealtimeGrants } from './grants';
import { createRealtimeHub } from './hub';
import { createMemoryPubSub } from './memoryPubSub';
import { fleetStore } from '../../core/server/fleet/link';
import { createMemoryKv, KV_METHODS } from '../actions/runtime/memoryKv';

import type { ChannelResolver } from './declarations';
import type { RealtimeGrants } from './grants';
import type { RealtimeHub } from './hub';
import type { ActionKvAdapter } from '../actions/types';
import type { RealtimeTransport, SSRServerConfig } from '@plitzi/sdk-shared';

export { createMemoryPubSub } from './memoryPubSub';
export { handleRealtimePublish, handleRealtimeSubscribe } from './handlers';
export { handleRealtimeSocket } from './socket';

/** A type a flow publishes: its own vocabulary — the `$` types are the channel's. */
const SERVER_TYPE = /^[A-Za-z0-9_.:-]{1,64}$/;

export type RealtimeModule = {
  hub: RealtimeHub;
  path: string;
  /** What pages are told to connect with. Both are served whatever this says. */
  transport: RealtimeTransport;
  /** Origins besides the server's own whose pages may open a socket. */
  allowedOrigins: readonly string[];
  resolveChannels: ChannelResolver;
  /** The grants issued for topics of channels declared `grant: true`, and the check a subscription makes. */
  grants: RealtimeGrants;
  /** Closes every connection this process holds: the server is shutting down (`HttpServerParts.onClosing`). */
  close: () => void;
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
  /**
   * A grant for one topic of a channel declared `grant: true` — what a flow's `realtime.grant` hands a page, once it
   * has decided the visitor may be there. Refused for a topic of any other channel: a grant it would never ask for
   * is a mistake in the flow, not a key to hand out.
   */
  grant: (space: { spaceId: number; environment: string }, topic: string, ttlSeconds?: number) => Promise<string>;
  /**
   * `grant` no longer opens `topic` — or, naming none, no grant issued for it until now does: nobody who holds one gets
   * in again, and whoever is on the topic with one, on any replica, is let go of it (`$revoked`). A page kept out asks
   * the action that lets it in for a new grant, if it still may.
   */
  revoke: (space: { spaceId: number; environment: string }, topic: string, grant?: string) => Promise<void>;
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
  // Where the actions keep their `kv`, so a grant one replica issues opens the topic on another; the fleet's shared
  // copy, or this process's own, where the deployment gave none — the same fallbacks the actions take.
  const grants = createRealtimeGrants(
    config.action?.kv ?? fleetStore<ActionKvAdapter>('realtime.grants', KV_METHODS) ?? createMemoryKv()
  );
  const module: RealtimeModule = {
    hub,
    path: config.realtime?.path ?? '/_realtime',
    transport: config.realtime?.transport ?? 'sse',
    allowedOrigins: config.realtime?.allowedOrigins ?? [],
    resolveChannels,
    grants,
    close: () => hub.closeAll(),
    publish: async (space, topic, type, data) => {
      const channels = await resolveChannels(space.spaceId, space.environment);
      if (!matchChannel(topic, channels)) {
        throw new Error(`No channel of this space matches "${topic}": declare it in the space's \`channels\``);
      }

      if (!SERVER_TYPE.test(type)) {
        throw new Error('A message type is 1-64 of A-Z a-z 0-9 _ . : -');
      }

      await hub.publish(space, { topic, type, data, from: 'server', at: Date.now() });
    },
    grant: async (space, topic, ttlSeconds) => {
      const match = matchChannel(topic, await resolveChannels(space.spaceId, space.environment));
      if (!match) {
        throw new Error(`No channel of this space matches "${topic}": declare it in the space's \`channels\``);
      }

      if (match.declaration.grant !== true) {
        throw new Error(
          `"${match.pattern}" is open to anyone its access lets in, so it takes no grant: declare it \`grant: true\` to make its topics private`
        );
      }

      return grants.issue(space, topic, ttlSeconds);
    },
    revoke: async (space, topic, grant) => {
      const match = matchChannel(topic, await resolveChannels(space.spaceId, space.environment));
      if (match?.declaration.grant !== true) {
        throw new Error(
          `"${topic}" is not a topic of a private (\`grant: true\`) channel of this space: it has no grants to revoke`
        );
      }

      await grants.revoke(space, topic, grant);
      await hub.revoke(space, topic, grant);
    }
  };
  modules.set(config, module);

  return module;
};
