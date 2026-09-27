import { Redis } from 'ioredis';
import { afterAll } from 'vitest';

import { createRedisKv } from './redisKv';
import { describeKv } from '../jobs/testing/jobQueueContract';

/**
 * Skipped — not failed — on a machine with no Redis: `REDIS_TEST_URL` points it at one, and the default is the port the
 * services compose of plitzi-sdk-server publishes.
 */
const URL = process.env.REDIS_TEST_URL ?? 'redis://127.0.0.1:63790';
const PREFIX = 'sdk-server-test:kv:';

const redis = new Redis(URL, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 1_500 });
const available = await redis.connect().then(
  () => true,
  () => false
);

afterAll(async () => {
  if (available) {
    await redis.quit();
  }
});

const cleared = async (): Promise<void> => {
  const keys = await redis.keys(`${PREFIX}*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
};

describeKv('redis', () => Promise.resolve({ kv: createRedisKv(redis, { prefix: PREFIX }), clear: cleared }), available);
