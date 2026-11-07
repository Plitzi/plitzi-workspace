import { describe, expect, it, vi } from 'vitest';

import { serverLog } from '@plitzi/sdk-kernel/log';

import { createMemoryJobQueue } from './memoryQueue';
import { createActionsModule } from '../module';
import { MIDNIGHT, entry, settle, world } from './tests/jobWorld';
import { RunLimitReached } from '../runtime/errors';

/**
 * How much a worker takes at once: what its memory, its CPU and the guards' ceilings leave room for, its slots a ceiling
 * — and what it hands back, and how soon.
 */
describe('how much a job worker takes', () => {
  // A large worker kept for the heavy jobs is idle most of the time: it helps the others, keeping a slot of its own.
  it('takes others’ jobs while it has more than one slot free, and keeps one for its own', async () => {
    const test = world(() => new Promise(() => {}));
    for (const id of ['a', 'b', 'c']) {
      await test.job({ id: `other-${id}`, spaceId: 2 });
    }

    const large = test.worker({ workers: 3, spaces: () => ({ only: [1] }), helps: () => ({ except: [1] }) });

    expect(await large.poll()).toBe(2);
    await settle();
    // One slot left: kept for its own, which none is.
    expect(await large.poll()).toBe(0);
  });

  // Short jobs end in milliseconds: waiting a poll between them ran a queue of them at one a second a slot.
  it('takes its slot again as soon as its job ends, not at the next poll', async () => {
    const seen = vi.fn(() => ({ ok: true }));
    const test = world(seen);
    for (const id of ['a', 'b', 'c']) {
      await test.job({ id: `quick-${id}` });
    }

    const worker = test.worker({ workers: 1, pollMs: 60_000 });
    worker.start();
    try {
      await worker.poll();
      await settle();

      expect(seen).toHaveBeenCalledTimes(3);
    } finally {
      await worker.stop();
    }
  });

  it('takes no new job near its memory, whatever slots it has, and says so once', async () => {
    const warn = vi.spyOn(serverLog, 'warn').mockImplementation(() => undefined);
    const test = world(() => ({ ok: true }));
    await test.job();
    const full = test.worker({
      workers: 8,
      memory: () => ({ mb: 512, ceilingMb: 1024 }),
      readMemory: () => ({ rssMb: 470, heapUsedMb: 100, heapLimitMb: 259 })
    });

    expect([await full.poll(), await full.poll()]).toEqual([0, 0]);
    expect(
      warn.mock.calls.filter(([, said]) => typeof said === 'string' && said.includes('takes no new job'))
    ).toHaveLength(1);
    warn.mockRestore();
  });

  it('takes no new job with its CPU spent, whatever slots it has, and says so once', async () => {
    const warn = vi.spyOn(serverLog, 'warn').mockImplementation(() => undefined);
    const test = world(() => ({ ok: true }));
    await test.job();
    const busy = test.worker({ workers: 8, readLoad: () => ({ cpuCores: 0.24, cpuShare: 0.96, lagMs: 40 }) });

    expect([await busy.poll(), await busy.poll()]).toEqual([0, 0]);
    expect(
      warn.mock.calls.filter(([, said]) => typeof said === 'string' && said.includes('CPU is 96% used'))
    ).toHaveLength(1);
    warn.mockRestore();
  });

  // Its size is the most it may hold, not how many it runs: a job waiting a minute on somebody's API holds a few MiB,
  // and what it takes is what its memory still has room for — read off what the ones it runs hold.
  it('takes as many jobs at once as its memory has room for, by what the ones it runs hold', async () => {
    const test = world(() => new Promise(() => {}));
    for (let index = 0; index < 40; index += 1) {
      // Over four spaces: a space runs ten at once (`concurrency.perSpace`), however much room the worker has.
      await test.job({ id: `wait-${String(index)}`, spaceId: (index % 4) + 1 });
    }

    let rssMb = 300;
    const worker = test.worker({
      workers: 64,
      leaseMs: 60_000,
      memory: () => ({ mb: 512, ceilingMb: 1024 }),
      readMemory: () => ({ rssMb, heapUsedMb: 100, heapLimitMb: 1024 })
    });

    // 135 MiB of room under 85% of 512, at 8 MiB a job until it has measured one.
    expect(await worker.poll()).toBe(16);
    await settle();
    // The sixteen hold 2 MiB each: still reckoned eight a job, the least, which twelve more fit.
    rssMb = 332;
    expect(await worker.poll()).toBe(12);
    await settle();
    // The twenty-eight hold 4 MiB each: 23 MiB of room is two more.
    rssMb = 412;
    expect(await worker.poll()).toBe(2);
    await settle();
    expect(worker.inFlight()).toBe(30);
  });

  // Claimed past its space's ceiling, a job was handed back refused — and waited a failure's backoff for nothing.
  it('claims no job of a space at its ceiling, and leaves it untouched for when a slot frees', async () => {
    const test = world(() => new Promise(() => {}), [entry()], { perSpace: 2 });
    for (const id of ['a', 'b', 'c']) {
      await test.job({ id: `busy-${id}` });
    }

    const worker = test.worker({ workers: 8, leaseMs: 60_000 });
    expect(await worker.poll()).toBe(3);
    await settle();
    // Two run; the third was refused at the ceiling and comes round in a second or two, not a backoff's half minute.
    const refused = (await test.queue.listJobs({ spaceIds: [1], status: 'pending', limit: 5, offset: 0 })).jobs;
    expect(refused).toHaveLength(1);
    expect(refused[0]?.runAt).toBeLessThanOrEqual(MIDNIGHT + 2_000);
    expect(refused[0]?.attempts).toBe(0);
    // Now its space is full: the next pass takes none of it.
    test.advance(5_000);
    expect(await worker.poll()).toBe(0);
  });

  // A worker of 256 jobs at once stopped at the guards' 100 calls a process, saying nothing.
  it('runs as many jobs as its workers say, not the guards’ 100 calls a process', () => {
    const queue = createMemoryJobQueue();
    const lookups = { getAction: () => Promise.resolve(undefined), listActions: () => Promise.resolve([]) };
    const module = createActionsModule({ lookups, jobs: { queue, workers: 256, produce: false } });

    expect(module.guards.slots().calls.of).toBe(356);
  });

  // Each may need all a worker has: two at once is the death the first one escaped.
  it('runs one job a worker died running at a time, and hands the others back untouched', async () => {
    const test = world(() => new Promise(() => {}));
    await test.job({ id: 'heavy-a', needsMemoryMb: 513 });
    await test.job({ id: 'heavy-b', needsMemoryMb: 513 });
    const large = test.worker({
      workers: 4,
      leaseMs: 60_000,
      memory: () => ({ mb: 1024, ceilingMb: 1024 }),
      readMemory: () => ({ rssMb: 300, heapUsedMb: 100, heapLimitMb: 1024 })
    });

    expect(await large.poll()).toBe(1);
    await settle();
    expect(await large.poll()).toBe(0);
    expect(await test.read('heavy-b')).toMatchObject({ status: 'pending', attempts: 0 });
  });

  // A budget over the minute spent is not now, not wrong: a busy minute must not set a healthy job aside.
  it('puts back a job whose account spent its CPU for the minute, for the next one, its attempt refunded', async () => {
    const test = world(() => {
      throw new RunLimitReached('cpuBudget', 'This account’s functions have used their CPU for this minute');
    });
    await test.job();

    await test.worker().poll();
    await settle();

    const job = await test.read();
    expect(job).toMatchObject({ status: 'pending', attempts: 0 });
    expect(job.runAt).toBeGreaterThanOrEqual(Math.ceil((MIDNIGHT + 1) / 60_000) * 60_000);
  });

  it('carries as many jobs at once as it was told to, and no more', async () => {
    let live = 0;
    let peak = 0;
    const test = world(async () => {
      live += 1;
      peak = Math.max(peak, live);
      await new Promise(resolve => setTimeout(resolve, 20));
      live -= 1;

      return { ok: true };
    });

    const entries = Array.from({ length: 10 }, (_item, index) => index);
    for (const index of entries) {
      await test.job({ id: `job-${index}` });
    }

    const worker = test.worker({ workers: 3, leaseMs: 60_000 });
    expect(await worker.poll()).toBe(3);
    await settle();

    expect(peak).toBe(3);
  });

  it('produces without consuming when it is given no workers', async () => {
    const ran = vi.fn(() => ({ ok: true }));
    const test = world(ran);
    await test.job();

    const worker = test.worker({ workers: 0 });
    worker.start();
    expect(await worker.poll()).toBe(0);
    await worker.stop();

    expect(ran).not.toHaveBeenCalled();
  });
});
