import { fleetStore } from '@plitzi/sdk-kernel/http';
import { createMemoryPubSub } from '@plitzi/sdk-kernel/pubsub';
import { matchChannel } from '@plitzi/sdk-shared/realtime';

import { createChannelResolver } from './declarations';
import { createRealtimeGrants } from './grants';
import { publishFrom } from './handlers';
import { createRealtimeHub } from './hub';
import { publishJobView } from './jobs';
import { createRealtimePresence } from './presence';
import { createRealtimeRetained } from './retained';
import { createMemoryKv, KV_METHODS } from '../engine/runtime/memoryKv';

import type { ChannelResolver } from './declarations';
import type { RealtimeGrants } from './grants';
import type { RealtimeHub } from './hub';
import type { JobLookup } from './jobs';
import type { RealtimePresenceMember } from './presence';
import type { ActionKvAdapter, ActionRealtime } from '../engine/types';
import type { EngineConfig } from '../types';
import type { FunctionJobView, PubSubAdapter, RealtimeTransport } from '@plitzi/sdk-shared';

export { handleRealtimePublish, handleRealtimeSubscribe } from './handlers';
export { handleRealtimeSocket } from './socket';

/** A type a flow publishes: its own vocabulary — the `$` types are the channel's. */
/** Where a page's realtime channels are, and how it reaches them, when the deployment says nothing. */
export const DEFAULT_REALTIME_PATH = '/_realtime';
export const DEFAULT_REALTIME_TRANSPORT: RealtimeTransport = 'sse';

const SERVER_TYPE = /^[A-Za-z0-9_.:-]{1,64}$/;

export type RealtimeModule = {
  hub: RealtimeHub;
  path: string;
  /** What pages are told to connect with. Both are served whatever this says. */
  transport: RealtimeTransport;
  /** Origins besides the server's own whose pages may open a socket. */
  allowedOrigins: readonly string[];
  /** The deployment's say on whether a space opens its channels (`realtime.admitSpace`). */
  admitSpace?: (spaceId: number) => Promise<string | undefined>;
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
  /**
   * Who is on a topic of a `presence: true` channel now, on every replica — what a function's `ctx.presence` reads. A
   * topic of any other channel is refused: nobody is counted there, and an empty answer would read as an empty room.
   */
  presence: (
    space: { spaceId: number; environment: string },
    topic: string
  ) => Promise<{ count: number; members: RealtimePresenceMember[] }>;
  /** Says a job of the space's functions as it is now on its topic (`$job:<id>`), kept for a page that joins later. */
  publishJob: (space: { spaceId: number; environment: string }, jobId: string, view: FunctionJobView) => Promise<void>;
  /** Hands the realtime the way to a job, which the actions module holds: what the door of `$job:<id>` reads. */
  watchJobs: (lookup: JobLookup) => void;
  /** The way to a job, once the actions module handed it — what a subscription to `$job:<id>` is decided by. */
  jobs: () => JobLookup | undefined;
};

const modules = new WeakMap<object, RealtimeModule>();

/**
 * The server's realtime channels, built once per config — or `undefined` when they are off or cannot be: without the
 * space's documents (`getOfflineData`) there is nothing to say which channels a space declares, so none is opened.
 */
/**
 * What a server's realtime channels are made of — the hub over `pubsub`, the grants, presence and what a `retain`
 * channel keeps in `kv` — given what it needs alone, so a process that is no page server (a deployment's own actions
 * runner, `createActionsModule`) publishes on the same channels as the pages: hand it the same `pubsub` and `kv` the
 * page servers have, or what it says is heard by nobody. `realtimeModuleFor` makes a page server's with this.
 */
export type RealtimeModuleOptions = {
  /** The space's documents, where its `channels` are declared. */
  getOfflineData: NonNullable<EngineConfig['adapters']['getOfflineData']>;
  /** What carries a message to every replica (`createRedisPubSub`). Absent, this process alone. */
  pubsub?: PubSubAdapter;
  /** Where grants, presence and retained messages are kept, shared by every replica. Absent, this process alone. */
  kv?: ActionKvAdapter;
  path?: string;
  transport?: RealtimeTransport;
  allowedOrigins?: readonly string[];
  admitSpace?: (spaceId: number) => Promise<string | undefined>;
};

export const createRealtimeModule = (options: RealtimeModuleOptions): RealtimeModule => {
  const kv = options.kv ?? createMemoryKv();
  const retained = createRealtimeRetained(kv);
  const presence = createRealtimePresence(kv);
  // Answers a publish relayed from another replica as one of its own: a page's stream and its requests may reach two.
  const hub: RealtimeHub = createRealtimeHub(options.pubsub ?? createMemoryPubSub(), retained, presence, {
    answer: (connection, publish) => publishFrom(hub, connection, publish)
  });
  const resolveChannels = createChannelResolver(options.getOfflineData);
  const grants = createRealtimeGrants(kv);
  let jobLookup: JobLookup | undefined;
  const module: RealtimeModule = {
    hub,
    path: options.path ?? DEFAULT_REALTIME_PATH,
    transport: options.transport ?? DEFAULT_REALTIME_TRANSPORT,
    allowedOrigins: options.allowedOrigins ?? [],
    ...(options.admitSpace ? { admitSpace: options.admitSpace } : {}),
    resolveChannels,
    grants,
    close: () => hub.closeAll(),
    publish: async (space, topic, type, data) => {
      const match = matchChannel(topic, await resolveChannels(space.spaceId, space.environment));
      if (!match) {
        throw new Error(`No channel of this space matches "${topic}": declare it in the space's \`channels\``);
      }

      if (!SERVER_TYPE.test(type)) {
        throw new Error('A message type is 1-64 of A-Z a-z 0-9 _ . : -');
      }

      const retain = match.declaration.retain === true;
      const message = {
        topic,
        type,
        data,
        from: 'server',
        at: Date.now(),
        ...(retain ? { retained: true as const } : {})
      };
      // Kept before it is said: a page that joins after hearing nothing still finds it, and one refused is never sent.
      if (retain) {
        await retained.keep(space, message);
      }

      await hub.publish(space, message);
    },
    presence: async (space, topic) => {
      const match = matchChannel(topic, await resolveChannels(space.spaceId, space.environment));
      if (!match) {
        throw new Error(`No channel of this space matches "${topic}": declare it in the space's \`channels\``);
      }

      if (match.declaration.presence !== true) {
        throw new Error(
          `"${match.pattern}" counts nobody: declare it \`presence: true\` for its pages to be counted, and read here`
        );
      }

      const members = await presence.of(space, topic);

      return { count: members.length, members };
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
    },
    publishJob: (space, jobId, view) => publishJobView(hub, retained, space, jobId, view),
    watchJobs: lookup => {
      jobLookup = lookup;
    },
    jobs: () => jobLookup
  };

  return module;
};

/**
 * The channels an actions runner that serves no pages publishes on (`createActionsModule({ realtime })`): a job's
 * `ctx.publish`, a flow's `realtime.publish`, a function job's `$job:<id>`. Without them a job that publishes fails on
 * that runner — handed the same `pubsub` and `kv` as the page servers, it reaches every page they hold open.
 */
export const createActionRealtime = (options: RealtimeModuleOptions): ActionRealtime => createRealtimeModule(options);

export const realtimeModuleFor = (config: EngineConfig): RealtimeModule | undefined => {
  const getOfflineData = config.adapters.getOfflineData;
  if (config.realtime === false || !getOfflineData) {
    return undefined;
  }

  const existing = modules.get(config);
  if (existing) {
    return existing;
  }

  const module = createRealtimeModule({
    getOfflineData,
    ...(config.realtime?.pubsub ? { pubsub: config.realtime.pubsub } : {}),
    // Where the actions keep their `kv`, so a grant one replica issues opens the topic on another — and what a
    // `retain: true` channel keeps reaches a page joining on another; the fleet's shared copy, or this process's own,
    // where the deployment gave none — the same fallbacks the actions take.
    kv: config.action?.kv ?? fleetStore<ActionKvAdapter>('realtime.kv', KV_METHODS) ?? createMemoryKv(),
    ...(config.realtime?.path ? { path: config.realtime.path } : {}),
    ...(config.realtime?.transport ? { transport: config.realtime.transport } : {}),
    ...(config.realtime?.allowedOrigins ? { allowedOrigins: config.realtime.allowedOrigins } : {}),
    ...(config.realtime?.admitSpace ? { admitSpace: config.realtime.admitSpace } : {})
  });
  modules.set(config, module);

  return module;
};
