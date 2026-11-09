import { describe, expect, it } from 'vitest';

import { hostable } from '@plitzi/sdk-kernel/http';
import { simulatedFleet } from '@plitzi/sdk-kernel/testing';

import { createMemoryJobQueue, JOB_QUEUE_METHODS } from './jobs/memoryQueue';
import { describeJobQueue, describeKv } from './jobs/tests/jobQueueContract';
import { createMemoryKv, KV_METHODS } from './runtime/memoryKv';

import type { ActionKvAdapter } from './types';
import type { JobQueue } from '../types';

describe('the actions stores the primary keeps for its workers', () => {
  it('counts every increment once, however the workers interleave them', async () => {
    const fleet = simulatedFleet({ kv: hostable(() => createMemoryKv(), KV_METHODS) });
    const workers = [1, 2, 3, 4].map(id => fleet.worker(id).client.remote<ActionKvAdapter>('kv#0', KV_METHODS));

    const answers = await Promise.all(
      Array.from({ length: 200 }, (_, index) => workers[index % workers.length].increment('hits', 1))
    );

    expect(new Set(answers).size).toBe(200);
    expect(answers.filter(total => total === 1)).toHaveLength(1);
  });

  it("brings the queue's dates back as dates", async () => {
    const fleet = simulatedFleet({ jobs: hostable(() => createMemoryJobQueue(), JOB_QUEUE_METHODS) });
    const queue = fleet.worker(1).client.remote<JobQueue>('jobs#0', JOB_QUEUE_METHODS);

    expect(await queue.now()).toBeInstanceOf(Date);
  });
});

// The primary's stores as a worker reaches them keep the contract the stores keep in one process.
describeJobQueue('memory, over the fleet channel', () => {
  const fleet = simulatedFleet({ jobs: hostable(() => createMemoryJobQueue(), JOB_QUEUE_METHODS) });

  return Promise.resolve({
    queue: fleet.worker(1).client.remote<JobQueue>('jobs#0', JOB_QUEUE_METHODS),
    clear: () => Promise.resolve()
  });
});

describeKv('memory, over the fleet channel', () => {
  const fleet = simulatedFleet({ kv: hostable(() => createMemoryKv(), KV_METHODS) });

  return Promise.resolve({
    kv: fleet.worker(1).client.remote<ActionKvAdapter>('kv#0', KV_METHODS),
    clear: () => Promise.resolve()
  });
});
