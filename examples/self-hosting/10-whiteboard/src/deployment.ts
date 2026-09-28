import { randomBytes } from 'node:crypto';

import { Redis } from 'ioredis';

import { createMemoryPubSub, createRedisPubSub } from '@plitzi/sdk-server';
import { createRedisKv } from '@plitzi/sdk-server/actions';

import { createMemoryAssets, createRedisAssets } from './board/assets.ts';

import type { AssetStore } from './board/assets.ts';
import type { PubSubAdapter } from '@plitzi/sdk-server';
import type { ActionKvAdapter } from '@plitzi/sdk-server/actions';

/**
 * What decides whether this is one server or one of several — in two halves, because on the platform the first is the
 * platform's and only the second is Pizarra's own runtime:
 *
 * - **The server's** ({@link serverStoresFrom}): where the boards (the action `kv`) and the channels live, and the
 *   secret keys are signed with. Self-hosted, this process's; on the platform, the platform's.
 * - **The runtime's** ({@link runtimeStoresFrom}): the pictures, and which replica holds each agent.
 *
 * - **One process** (no `REDIS_URL`): everything in memory. A restart starts over.
 * - **Replicas** (`REDIS_URL` and `SIGNING_SECRET`): all of it in one Redis they all reach, and one secret they all sign
 *   with. A person on one replica and a person on another are on the same board: they see each other's cursors, and
 *   neither's commit is lost to the other's. An agent connected over HTTP is held by the replica it reached first,
 *   which says so in Redis under its own address (`REPLICA_URL`): a request for it that another replica takes is
 *   passed on there.
 */

/**
 * Which replica holds each agent connected over HTTP (`agent/hosted.ts`). An agent is more than its requests — it is on
 * a board, with a socket on its channels and what it has heard since — so it lives where it was opened, and this is
 * how the others find it.
 */
export type AgentDirectory = {
  /** This replica's address as the others reach it. Absent for one process, and for a replica not told its own. */
  self?: string;
  /** This replica holds `session` — said again with every request, so a session nobody uses is forgotten. */
  hold: (session: string) => Promise<void>;
  ownerOf: (session: string) => Promise<string | undefined>;
  release: (session: string) => Promise<void>;
};

/** How long a quiet agent is remembered: as long as the replica holding it keeps it (`AGENT_IDLE_MS`), and a little. */
const AGENT_TTL_SECONDS = 35 * 60;
/** What the server serving the boards keeps: on the platform, the platform's own. */
export type ServerStores = {
  /** Where the `kv` tasks keep things — the server's in-process default when absent. */
  kv?: ActionKvAdapter;
  pubsub: PubSubAdapter;
  /** The server's `action.signingSecret`: what `ctx.sign` derives the space's key from, the same on every replica. */
  signingSecret: string;
  /** What the log says this is. */
  describe: string;
  close: () => Promise<void>;
};

/** What Pizarra's runtime keeps of its own, wherever it runs. */
export type RuntimeStores = {
  assets: AssetStore;
  agents: AgentDirectory;
  close: () => Promise<void>;
};

type Env = Readonly<Record<string, string | undefined>>;

const PREFIX = 'pizarra:';

/** One process holds every agent there is: none to find anywhere else. */
const soloAgents: AgentDirectory = {
  hold: () => Promise.resolve(),
  ownerOf: () => Promise.resolve(undefined),
  release: () => Promise.resolve()
};

const createRedisAgents = (redis: Redis, self: string | undefined): AgentDirectory => {
  const key = (session: string): string => `${PREFIX}agent:${session}`;

  return {
    ...(self ? { self } : {}),
    hold: async session => {
      if (self) {
        await redis.set(key(session), self, 'EX', AGENT_TTL_SECONDS);
      }
    },
    ownerOf: async session => (await redis.get(key(session))) ?? undefined,
    release: async session => {
      await redis.del(key(session));
    }
  };
};

/**
 * This replica's address as the others reach it: `REPLICA_URL` — a pod's own IP, a container's name — or, for a
 * replica listening on loopback beside the others, its port there. A replica listening everywhere is not guessed at:
 * the address others reach it by is the network's to say.
 */
const replicaAddress = (env: Env): string | undefined => {
  if (env.REPLICA_URL) {
    return env.REPLICA_URL.replace(/\/+$/, '');
  }

  const host = env.HOST ?? '127.0.0.1';

  return host === '127.0.0.1' || host === 'localhost' ? `http://127.0.0.1:${env.PORT ?? '4016'}` : undefined;
};

export const serverStoresFrom = (env: Env): ServerStores => {
  const url = env.REDIS_URL;
  if (!url) {
    return {
      pubsub: createMemoryPubSub(),
      // Made at boot unless given: the boards are in this process's memory too, so nothing signed outlives it.
      signingSecret: env.SIGNING_SECRET ?? randomBytes(32).toString('base64url'),
      describe: 'one process, everything in memory',
      close: () => Promise.resolve()
    };
  }

  // Refused rather than made up: each replica would sign with its own, and a locked board opened on one would be
  // locked again on the next.
  if (!env.SIGNING_SECRET) {
    throw new Error('Replicas share REDIS_URL and SIGNING_SECRET: set SIGNING_SECRET to the same value on every one');
  }

  // A connection in subscriber mode can do nothing else — hence the second one.
  const redis = new Redis(url);
  const subscriber = new Redis(url);
  const self = replicaAddress(env);

  return {
    kv: createRedisKv(redis, { prefix: `${PREFIX}kv:` }),
    pubsub: createRedisPubSub({ publisher: redis, subscriber, prefix: `${PREFIX}rt:` }),
    signingSecret: env.SIGNING_SECRET,
    describe: self
      ? `a replica at ${self}, sharing ${new URL(url).host}`
      : `a replica, sharing ${new URL(url).host} — set REPLICA_URL to this replica's own address, or pin /mcp to one ` +
        'replica by its Mcp-Session-Id header: an agent is held where it connected',
    close: async () => {
      await Promise.all([redis.quit(), subscriber.quit()]);
    }
  };
};

export const runtimeStoresFrom = (env: Env): RuntimeStores => {
  const url = env.REDIS_URL;
  if (!url) {
    return { assets: createMemoryAssets(), agents: soloAgents, close: () => Promise.resolve() };
  }

  const redis = new Redis(url);

  return {
    assets: createRedisAssets(redis, PREFIX),
    agents: createRedisAgents(redis, replicaAddress(env)),
    close: async () => {
      await redis.quit();
    }
  };
};
