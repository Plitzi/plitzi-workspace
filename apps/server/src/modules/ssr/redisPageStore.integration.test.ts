import { Redis } from 'ioredis';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createRedisPageStore } from './redisPageStore';

/**
 * Skipped — not failed — on a machine with no Redis: `REDIS_TEST_URL` points it at one, and the default is the port the
 * services compose of plitzi-sdk-server publishes.
 */
const URL = process.env.REDIS_TEST_URL ?? 'redis://127.0.0.1:63790';
const PREFIX = `sdk-server-test:{pages-${process.pid}}:`;

const redis = new Redis(URL, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 1_500 });
const available = await redis.connect().then(
  () => true,
  () => false
);

const cleared = async (): Promise<void> => {
  const keys = await redis.keys(`${PREFIX}*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
};

afterAll(async () => {
  if (available) {
    await cleared();
    await redis.quit();
  }
});

const page = (text: string, renderedAt = 1_000) => ({
  encoding: 'br' as const,
  body: Buffer.from([0, 255, 10, 58, ...Buffer.from(text)]),
  renderedAt
});

describe.skipIf(!available)('the Redis page store', () => {
  const store = createRedisPageStore(redis, { prefix: PREFIX });

  beforeEach(cleared);

  it('hands back a page byte for byte, with when it was rendered', async () => {
    await store.set('home', page('home', 1_234), { spaceId: 1, environment: 'production', hostname: 'a.test' }, 60_000);

    expect(await store.get('home')).toEqual(page('home', 1_234));
    expect(await store.get('nowhere')).toBeUndefined();
  });

  it('drops a space’s pages and leaves another’s', async () => {
    await store.set('a', page('a'), { spaceId: 1, environment: 'production', hostname: 'a.test' }, 60_000);
    await store.set('b', page('b'), { spaceId: 2, environment: 'production', hostname: 'b.test' }, 60_000);

    expect(await store.invalidate({ spaceId: 1 })).toBe(1);
    expect(await store.get('a')).toBeUndefined();
    expect(await store.get('b')).toBeDefined();
  });

  it('drops only the environment and the host a filter names', async () => {
    const at = (environment: string, hostname: string) => ({ spaceId: 1, environment, hostname });
    await store.set('prod-a', page('1'), at('production', 'a.test'), 60_000);
    await store.set('prod-b', page('2'), at('production', 'b.test'), 60_000);
    await store.set('staging-a', page('3'), at('staging', 'a.test'), 60_000);

    expect(await store.invalidate({ spaceId: 1, environment: 'production', hostname: 'a.test' })).toBe(1);
    expect(await store.get('prod-b')).toBeDefined();
    expect(await store.get('staging-a')).toBeDefined();
    expect(await store.invalidate({ hostname: 'a.test' })).toBe(1);
    expect(await store.get('prod-b')).toBeDefined();
  });

  it('drops everything without a filter', async () => {
    await store.set('a', page('a'), { spaceId: 1, environment: 'production', hostname: 'a.test' }, 60_000);
    await store.set('b', page('b'), { spaceId: 2, environment: 'production', hostname: 'b.test' }, 60_000);

    expect(await store.invalidate()).toBe(2);
    expect(await store.get('b')).toBeUndefined();
  });

  it('lets a page go when its time is up', async () => {
    await store.set('brief', page('brief'), { spaceId: 1, environment: 'production', hostname: 'a.test' }, 50);
    await new Promise(resolve => setTimeout(resolve, 120));

    expect(await store.get('brief')).toBeUndefined();
  });

  // The Redis a deployment runs holds job queues and sessions too: a cache without a budget there fills it.
  it('drops the oldest pages to stay within the bytes it may hold', async () => {
    const small = createRedisPageStore(redis, { prefix: PREFIX, maxBytes: 100 });
    const facts = { spaceId: 1, environment: 'production', hostname: 'a.test' };
    for (const key of ['first', 'second', 'third']) {
      await small.set(key, page('x'.repeat(30)), facts, 60_000);
    }

    expect(await small.get('first')).toBeUndefined();
    expect(await small.get('second')).toBeDefined();
    expect(await small.get('third')).toBeDefined();
    expect(Number(await redis.get(`${PREFIX}bytes`))).toBeLessThanOrEqual(100);
  });

  // One server renders many spaces: one that fills the store is the one that gives way, not the space beside it.
  it('takes the room it needs from the space that holds the most', async () => {
    const small = createRedisPageStore(redis, { prefix: PREFIX, maxBytes: 150 });
    const at = (spaceId: number) => ({ spaceId, environment: 'production', hostname: `${spaceId}.test` });
    await small.set('quiet', page('x'.repeat(30)), at(2), 60_000);
    for (const key of ['busy-1', 'busy-2', 'busy-3']) {
      await small.set(key, page('x'.repeat(30)), at(1), 60_000);
    }

    await small.set('busy-4', page('x'.repeat(30)), at(1), 60_000);

    expect(await small.get('quiet')).toBeDefined();
    expect(await small.get('busy-1')).toBeUndefined();
    expect(await small.get('busy-4')).toBeDefined();
  });

  it('counts a page stored again once, and gives its bytes back when it is invalidated', async () => {
    const facts = { spaceId: 1, environment: 'production', hostname: 'a.test' };
    await store.set('home', page('home'), facts, 60_000);
    const once = Number(await redis.get(`${PREFIX}bytes`));
    await store.set('home', page('home'), facts, 60_000);

    expect(once).toBeGreaterThan(0);
    expect(Number(await redis.get(`${PREFIX}bytes`))).toBe(once);
    await store.invalidate({ spaceId: 1 });
    expect(Number(await redis.get(`${PREFIX}bytes`))).toBe(0);
    expect(await redis.zcard(`${PREFIX}order:1`)).toBe(0);
    expect(await redis.zcard(`${PREFIX}held`)).toBe(0);
  });

  it('gives back the bytes of the pages past their TTL as it stores more', async () => {
    const facts = { spaceId: 1, environment: 'production', hostname: 'a.test' };
    await store.set('brief', page('brief'), facts, 50);
    await new Promise(resolve => setTimeout(resolve, 120));
    await store.set('next', page('next'), facts, 50);

    expect(await redis.zcard(`${PREFIX}order:1`)).toBe(1);
  });

  it('keeps nothing of a page larger than all it may hold', async () => {
    const small = createRedisPageStore(redis, { prefix: PREFIX, maxBytes: 10 });
    await small.set(
      'huge',
      page('x'.repeat(50)),
      { spaceId: 1, environment: 'production', hostname: 'a.test' },
      60_000
    );

    expect(await small.get('huge')).toBeUndefined();
  });

  it('reads a value it did not write as no page', async () => {
    await redis.set(`${PREFIX}page:foreign`, 'not a page');

    expect(await store.get('foreign')).toBeUndefined();
  });
});
