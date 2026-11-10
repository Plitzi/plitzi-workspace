import { Redis } from 'ioredis';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createRateLimit, memoryThrottleCounts, redisThrottleCounts } from './throttle';

import type { CountedAttempt, ThrottleCounts } from './throttle';

/**
 * The throttle's counts in Redis, the two stores held to the same answers. Skipped — not failed — on a machine with no
 * Redis: `REDIS_TEST_URL` points it at one, and the default is the port the services compose of plitzi-sdk-server
 * publishes. Every key is under this process's prefix, and removed.
 */
const URL = process.env.REDIS_TEST_URL ?? 'redis://127.0.0.1:63790';
const PREFIX = `sdk-server-test:{throttle-${String(process.pid)}}:`;

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

/** A clock the test moves: the windows are seconds of it. */
const clockAt = (start: number) => {
  const clock = { ms: start };

  return { clock, now: () => clock.ms };
};

const failures = async (
  limit: (attempt: CountedAttempt) => Promise<{ allowed: boolean }>,
  count: number,
  attempt: CountedAttempt
) => {
  const verdicts = [];
  for (let i = 0; i < count; i++) {
    verdicts.push(await limit(attempt));
  }

  return verdicts;
};

const STORES: [string, () => ThrottleCounts][] = [
  ['memory', memoryThrottleCounts],
  ['Redis', () => redisThrottleCounts(redis, { prefix: PREFIX })]
];

describe.skipIf(!available)('the throttle’s counts', () => {
  beforeEach(cleared);

  describe.each(STORES)('in %s', (_name, countsOf) => {
    it('lets ten failures through, refuses the eleventh, and says when to come back', async () => {
      const { now } = clockAt(1_000_000);
      const limit = createRateLimit({ counts: countsOf(), now });
      const verdicts = await failures(limit, 11, { action: 'login', key: 'ada' });

      expect(verdicts.slice(0, 10).every(verdict => verdict.allowed)).toBe(true);
      expect(verdicts[10]).toEqual({ allowed: false, retryAfter: 300 });
    });

    it('forgives once the window has passed', async () => {
      const { clock, now } = clockAt(1_000_000);
      const limit = createRateLimit({ counts: countsOf(), now });
      await failures(limit, 10, { action: 'login', key: 'ada' });
      clock.ms += 301_000;

      expect(await limit({ action: 'login', key: 'ada' })).toEqual({ allowed: true });
    });

    it("forgets an account's failures when it signs in, and gives the address back only that attempt", async () => {
      const { now } = clockAt(1_000_000);
      const limit = createRateLimit({ counts: countsOf(), now });
      // 29 failures from one address over other accounts, then ten on ada's.
      for (let i = 0; i < 29; i++) {
        await limit({ action: 'login', key: `other-${String(i)}`, address: '203.0.113.9' });
      }

      await limit({ action: 'login', key: 'ada', address: '203.0.113.9' });
      await limit({ action: 'login', key: 'ada', address: '203.0.113.9', succeeded: true });

      // The address's count gave back ada's attempt (29 left): one more account's is allowed, and the next is refused.
      expect(await limit({ action: 'login', key: 'grace', address: '203.0.113.9' })).toEqual({ allowed: true });
      expect(await limit({ action: 'login', key: 'henry', address: '203.0.113.9' })).toMatchObject({ allowed: false });
    });

    it('lets ten through of a hundred attempts sent at once', async () => {
      const { now } = clockAt(1_000_000);
      const limit = createRateLimit({ counts: countsOf(), now });
      const verdicts = await Promise.all(
        Array.from({ length: 100 }, () => limit({ action: 'login', key: 'ada', address: '198.51.100.7' }))
      );

      expect(verdicts.filter(verdict => verdict.allowed)).toHaveLength(10);
    });
  });

  it('holds two replicas to one count: the eleventh failure is refused by whichever answers it', async () => {
    const { now } = clockAt(1_000_000);
    const replicas = [0, 1].map(() => createRateLimit({ counts: redisThrottleCounts(redis, { prefix: PREFIX }), now }));
    const verdicts = [];
    for (let i = 0; i < 11; i++) {
      verdicts.push(await replicas[i % 2]({ action: 'login', key: 'ada', address: '192.0.2.4' }));
    }

    expect(verdicts.slice(0, 10).every(verdict => verdict.allowed)).toBe(true);
    expect(verdicts[10]).toMatchObject({ allowed: false });
    expect(await replicas[1]({ action: 'login', key: 'ada', address: '192.0.2.4' })).toMatchObject({ allowed: false });
  });
});
