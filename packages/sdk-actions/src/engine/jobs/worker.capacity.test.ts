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
  // A space's share is what it gets while another's work waits: the slot goes to the other space first.
  it('gives another space’s waiting job the slot before more of a space at its share', async () => {
    const test = world(() => new Promise(() => {}), [entry()], { perSpace: 2, perProcess: 5 });
    for (const id of ['a', 'b']) {
      await test.job({ id: `busy-${id}` });
    }

    const worker = test.worker({ workers: 3, leaseMs: 60_000 });
    expect(await worker.poll()).toBe(2);
    await settle();
    await test.job({ id: 'more-of-space-1' });
    await test.job({ id: 'other-space', spaceId: 2 });

    expect(await worker.poll()).toBe(1);
    await settle();
    expect((await test.queue.getJob([2], 'other-space'))?.status).toBe('running');
    expect((await test.read('more-of-space-1')).status).toBe('pending');
  });

  /**
   * The regression it guards: under a load probe a space's 20 ms actions waited 37 s behind its own share, held by its
   * runs that waited for a runner, while the worker had slots nobody else wanted. Past its share it takes the slots no
   * other space's work waits for — never the last share's worth, kept for the next space that comes.
   */
  it('takes a space’s job past its share in a slot nothing else waits for, keeping a share free', async () => {
    const test = world(() => new Promise(() => {}), [entry()], { perSpace: 2, perProcess: 5 });
    for (const id of ['a', 'b']) {
      await test.job({ id: `busy-${id}` });
    }

    const worker = test.worker({ workers: 8, leaseMs: 60_000 });
    expect(await worker.poll()).toBe(2);
    await settle();
    for (const id of ['c', 'd']) {
      await test.job({ id: `busy-${id}` });
    }

    // Five calls a process, two of a share kept free: one more of this space, past its share.
    expect(await worker.poll()).toBe(1);
    await settle();
    const statuses = await Promise.all(['busy-c', 'busy-d'].map(async id => (await test.read(id)).status));
    expect(statuses.sort()).toEqual(['pending', 'running']);
    expect(await worker.poll()).toBe(0);
  });

  /**
   * The regressions it guards: two workers held 430 runs as running while their two runners ran 26, each claimed only to
   * wait beside the others; held back from every claim, a burst's 20 ms actions then waited 105 s behind them. With ten
   * of its runs waiting for a runner it takes only jobs that run no space code (`target.code`) — those wait in the queue.
   */
  it('takes only jobs that run no space code while ten of its runs wait for a runner with room', async () => {
    const debug = vi.spyOn(serverLog, 'debug').mockImplementation(() => undefined);
    const test = world(() => ({ ok: true }));
    await test.job({ id: 'runs-code', target: { kind: 'action', name: 'digest', trigger: 'schedule', code: true } });
    await test.job({ id: 'runs-none' });
    let waiting = 10;
    test.module.runnerWaiting = () => waiting;
    const worker = test.worker({ workers: 8 });

    expect(await worker.poll()).toBe(1);
    await settle();
    expect((await test.read('runs-none')).status).toBe('succeeded');
    expect((await test.read('runs-code')).status).toBe('pending');
    expect(
      debug.mock.calls.some(([, words]) => words.includes('10 or more of its runs wait for a functions runner'))
    ).toBe(true);

    waiting = 9;
    expect(await worker.poll()).toBe(1);
    debug.mockRestore();
  });

  // One claim of every free slot took 160 jobs of space code at once, before any reached a runner to be counted as
  // waiting: it takes no more of them than its runs waiting leave room for, and every job that needs none.
  it('takes of the jobs that need a runner only what its runs waiting leave room for, and all the rest', async () => {
    const test = world(() => new Promise(() => {}));
    for (let n = 0; n < 8; n += 1) {
      await test.job({
        id: `code-${String(n)}`,
        target: { kind: 'action', name: 'digest', trigger: 'schedule', code: true }
      });
    }

    await test.job({ id: 'light-a' });
    await test.job({ id: 'light-b' });
    test.module.runnerWaiting = () => 5;

    expect(await test.worker({ workers: 32, leaseMs: 60_000 }).poll()).toBe(7);
    await settle();
    const pending = (await test.queue.listJobs({ spaceIds: [1], status: 'pending', limit: 20, offset: 0 })).jobs;
    expect(pending.map(job => job.id).every(id => id.startsWith('code-'))).toBe(true);
    expect(pending).toHaveLength(3);
  });

  // Its spare room read before the pass's own claim: it took past their share the slots kept free for the next space.
  it('keeps a share free past what the same look already took', async () => {
    const test = world(() => new Promise(() => {}), [entry()], { perSpace: 2, perProcess: 6 });
    for (const id of ['a', 'b']) {
      await test.job({ id: `busy-${id}` });
    }

    const worker = test.worker({ workers: 8, leaseMs: 60_000 });
    expect(await worker.poll()).toBe(2);
    await settle();
    await test.job({ id: 'other-space', spaceId: 2 });
    for (const id of ['c', 'd', 'e']) {
      await test.job({ id: `busy-${id}` });
    }

    // Six a process, two running and one taken of another space: one more past the share, two kept free.
    expect(await worker.poll()).toBe(2);
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

  // The period's allowance spent is a paywall, not a busy minute: retried, it would be refused until the period rolls.
  it('sets aside at once a job stopped at its plan’s allowance for the period, saying so', async () => {
    const test = world(() => {
      throw new RunLimitReached('quota', 'This space has used the 25,000 small-seconds its App plan includes');
    });
    await test.job();

    await test.worker().poll();
    await settle();

    const job = await test.read();
    expect(job).toMatchObject({ status: 'paused', attempts: 1 });
    expect(job.error).toContain('used the 25,000 small-seconds its App plan includes');
  });

  // The same code meets the same limit on every attempt: two more would spend a worker for nothing.
  it('sets aside at once a job stopped at a limit its plan sets, and retries one stopped at its time', async () => {
    const test = world(() => {
      throw new RunLimitReached('cpu', 'Stopped after 100 ms of CPU');
    });
    await test.job();

    await test.worker().poll();
    await settle();

    const job = await test.read();
    expect(job).toMatchObject({ status: 'paused', attempts: 1 });
    expect(job.error).toContain('Set aside at once: it reached a limit its plan sets');

    const slow = world(() => {
      throw new RunLimitReached('wall', 'Stopped after 10000 ms');
    });
    await slow.job();
    await slow.worker().poll();
    await settle();
    expect(await slow.read()).toMatchObject({ status: 'pending', attempts: 1 });
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
