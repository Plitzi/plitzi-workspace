import { createHash, randomBytes } from 'node:crypto';

import { Redis } from 'ioredis';

import { createMemoryPubSub, createRedisPubSub } from '@plitzi/sdk-server';

import { createMemoryAssets, createRedisAssets } from './board/assets.ts';
import { createSigner } from './board/locks.ts';

import type { AssetStore } from './board/assets.ts';
import type { BoardSigner } from './board/locks.ts';
import type { PubSubAdapter } from '@plitzi/sdk-server';
import type { ActionKvAdapter } from '@plitzi/sdk-server/actions';

/**
 * What decides whether this is one server or one of several: where the boards, the pictures and the channels live,
 * and what keys and topics are signed with.
 *
 * - **One process** (no `REDIS_URL`): everything in memory. A restart starts over.
 * - **Replicas** (`REDIS_URL` and `BOARD_SECRET`): the boards in the action `kv`, the pictures and every channel's
 *   messages in one Redis they all reach, and one secret they all sign with. A person on one replica and a person on
 *   another are on the same board: they see each other's cursors, and neither's commit is lost to the other's.
 */
export type Deployment = {
  /** Where the `kv` tasks keep things — the server's in-process default when absent. */
  kv?: ActionKvAdapter;
  pubsub: PubSubAdapter;
  assets: AssetStore;
  signer: BoardSigner;
  /** What the log says this is. */
  describe: string;
  close: () => Promise<void>;
};

const PREFIX = 'pizarra:';

/**
 * The `kv` seam over Redis: five commands, and nothing to decide — what a counter means is the server's.
 * `INCRBY` is atomic, which is what the boards' write lock and every rate limit rely on.
 */
const createRedisKv = (redis: Redis): ActionKvAdapter => {
  const key = (name: string): string => `${PREFIX}kv:${name}`;

  return {
    get: async name => (await redis.get(key(name))) ?? undefined,
    set: async (name, value, ttlSeconds) => {
      await (ttlSeconds === undefined ? redis.set(key(name), value) : redis.set(key(name), value, 'EX', ttlSeconds));
    },
    delete: async name => {
      await redis.del(key(name));
    },
    increment: (name, amount) => redis.incrby(key(name), amount),
    expire: async (name, ttlSeconds) => {
      await redis.expire(key(name), ttlSeconds);
    }
  };
};

/** The secret as the signer takes it: any length of text in, 32 bytes out. */
const secretFrom = (text: string): Buffer => createHash('sha256').update(text).digest();

export const deploymentFrom = (env: NodeJS.ProcessEnv): Deployment => {
  const url = env.REDIS_URL;
  if (!url) {
    return {
      pubsub: createMemoryPubSub(),
      assets: createMemoryAssets(),
      // Made at boot unless given: the boards are in this process's memory too, so nothing signed outlives it.
      signer: createSigner(env.BOARD_SECRET ? secretFrom(env.BOARD_SECRET) : randomBytes(32)),
      describe: 'one process, everything in memory',
      close: () => Promise.resolve()
    };
  }

  // Refused rather than made up: each replica would sign with its own, and a locked board opened on one would be
  // locked again on the next.
  if (!env.BOARD_SECRET) {
    throw new Error('Replicas share REDIS_URL and BOARD_SECRET: set BOARD_SECRET to the same value on every one');
  }

  // A connection in subscriber mode can do nothing else — hence the second one.
  const redis = new Redis(url);
  const subscriber = new Redis(url);

  return {
    kv: createRedisKv(redis),
    pubsub: createRedisPubSub({ publisher: redis, subscriber, prefix: `${PREFIX}rt:` }),
    assets: createRedisAssets(redis, PREFIX),
    signer: createSigner(secretFrom(env.BOARD_SECRET)),
    describe: `a replica, sharing ${new URL(url).host}`,
    close: async () => {
      await Promise.all([redis.quit(), subscriber.quit()]);
    }
  };
};
