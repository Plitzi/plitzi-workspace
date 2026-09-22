import { describe, expect, it, vi } from 'vitest';

import { createMemoryJobQueue } from './memoryQueue';
import { createJobWorker } from './worker';
import { createActionsModule } from '../index';

import type { ActionTask } from '../types';
import type { ActionEntry, ActionJobInput, ElementInteraction } from '@plitzi/sdk-shared';

const node = (id: string, overrides: Partial<ElementInteraction> = {}): ElementInteraction => ({
  id,
  title: id,
  type: 'task',
  action: '',
  params: {},
  preview: {},
  elementId: null,
  beforeNode: '',
  afterNode: '',
  flowId: 'flow',
  enabled: true,
  ...overrides
});

const entry = (id = 'digest'): ActionEntry => ({
  id,
  document: {
    name: id,
    nodes: {
      start: node('start', { type: 'trigger', action: 'schedule', params: { cron: '* * * * *' }, afterNode: 'work' }),
      work: node('work', { action: 'test.work', afterNode: '' })
    }
  }
});

const MIDNIGHT = Date.parse('2026-03-01T00:00:00Z');

const jobInput = (over: Partial<ActionJobInput> = {}): ActionJobInput => ({
  id: `schedule:1:digest:${MIDNIGHT}`,
  spaceId: 1,
  actionId: 'digest',
  environment: 'main',
  trigger: 'schedule',
  input: {},
  dueAt: MIDNIGHT,
  maxAttempts: 3,
  ...over
});

/** One queue, one module, and a task the test drives. */
const world = (run: ActionTask['run'], entries = [entry()]) => {
  let now = MIDNIGHT;
  const queue = createMemoryJobQueue({ clock: () => now });
  const lookups = {
    getAction: (_spaceId: number, actionId: string) => Promise.resolve(entries.find(item => item.id === actionId)),
    listActions: () => Promise.resolve(entries)
  };
  const task: ActionTask = { namespace: 'test', action: 'work', title: 'Work', params: {}, run };
  // `jobs: false` so the module builds no scheduler of its own; the test drives the worker directly.
  const module = createActionsModule({ lookups, tasks: [task], jobs: false });

  return {
    queue,
    module,
    lookups,
    advance: (ms: number) => {
      now += ms;
    },
    worker: (over: Parameters<typeof createJobWorker>[0] extends infer T ? Partial<T> : never = {}) =>
      createJobWorker({ queue, lookups, module, pollMs: 5, leaseMs: 1_000, onError: () => {}, ...over }),
    job: async (over: Partial<ActionJobInput> = {}) => {
      await queue.enqueue(jobInput(over));
    },
    read: async (id = jobInput().id) => {
      const job = await queue.getJob([1], id);
      if (!job) {
        throw new Error(`no job ${id}`);
      }

      return job;
    }
  };
};

/** Lets whatever the worker started settle: it deliberately does not await the runs it begins. */
const settle = async (): Promise<void> => {
  for (let pass = 0; pass < 40; pass += 1) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
};

describe('createJobWorker', () => {
  it('runs a job and records the attempt that did it', async () => {
    const seen = vi.fn(() => ({ ok: true }));
    const test = world(seen);
    await test.job();

    expect(await test.worker().poll()).toBe(1);
    await settle();

    const job = await test.read();
    expect(seen).toHaveBeenCalledTimes(1);
    expect(job.status).toBe('succeeded');
    expect(job.runId).toBeTruthy();
    expect(job.history).toMatchObject([{ attempt: 1, status: 'succeeded' }]);
  });

  it('hands a job to another worker when the one holding it stops reporting', async () => {
    // A run that never finishes: the process is alive, the lease is not renewed, the job must not be stranded.
    const test = world(() => new Promise(() => {}));
    await test.job();

    const stalled = test.worker({ workerId: 'pod-a' });
    expect(await stalled.poll()).toBe(1);
    await settle();
    expect((await test.read()).workerId).toBe('pod-a');

    // Nobody renewed it. The takeover is the QUEUE's guarantee, so it is asserted where it lives.
    test.advance(2_000);
    const [taken] = await test.queue.claim({ workerId: 'pod-b', leaseMs: 1_000, limit: 5 });

    expect(taken.workerId).toBe('pod-b');
    expect(taken.attempts).toBe(2);
    expect(taken.history).toMatchObject([{ attempt: 1, status: 'lost', workerId: 'pod-a' }]);
  });

  it('refuses to run the same job twice while the first one is still going', async () => {
    const started = vi.fn(() => new Promise(() => {}));
    const test = world(started);
    await test.job();

    expect(await test.worker({ workerId: 'pod-a' }).poll()).toBe(1);
    await settle();
    test.advance(2_000);

    // pod-b takes the lease over, but the single-flight key pod-a still holds refuses the run.
    expect(await test.worker({ workerId: 'pod-b' }).poll()).toBe(1);
    await settle();

    expect(started).toHaveBeenCalledTimes(1);
    const job = await test.read();
    expect(job.status).toBe('pending');
    // Handed back rather than held against it: a refusal to double-run is not a failed attempt.
    expect(job.attempts).toBe(1);
  });

  /**
   * The failure that used to empty the queue.
   *
   * A store that throws is not the job being wrong — it is the guards being unreachable — and counting it as an
   * attempt is how three attempts and a widening backoff turn a two-minute outage into every scheduled job in the
   * cluster marked `dead`, permanently.
   */
  it('gives the job back untouched when the shared store is unreachable', async () => {
    const ran = vi.fn(() => ({ ok: true }));
    const test = world(ran);
    await test.job();

    const unreachable = () => {
      throw new Error('Key/value storage is unavailable');
    };
    vi.spyOn(test.module.guards, 'begin').mockImplementationOnce(unreachable);

    await test.worker().poll();
    await settle();

    const held = await test.read();
    expect(held.status).toBe('pending');
    expect(held.attempts).toBe(0);
    expect(held.history).toEqual([]);
    expect(held.error).toContain('not started');
    expect(ran).not.toHaveBeenCalled();
  });

  it('retries a failure with a backoff, then leaves it for an operator', async () => {
    const test = world(() => {
      throw new Error('the provider said no');
    });
    await test.job({ maxAttempts: 2 });

    await test.worker().poll();
    await settle();
    let job = await test.read();
    expect(job.status).toBe('pending');
    expect(job.runAt).toBeGreaterThan(MIDNIGHT);

    // Nothing takes it before its backoff is up.
    expect(await test.worker().poll()).toBe(0);

    test.advance(10 * 60_000);
    await test.worker().poll();
    await settle();

    job = await test.read();
    expect(job.status).toBe('dead');
    expect(job.attempts).toBe(2);
    expect(job.history).toMatchObject([
      { attempt: 1, status: 'failed' },
      { attempt: 2, status: 'failed' }
    ]);
  });

  // "The flow ended failed" is true of every failure there is. What an operator opening the queue needs is which step
  // failed and what it said — the same, redacted, message the run history keeps.
  it('records which step failed and why, not only that the flow did', async () => {
    const test = world(() => {
      throw new Error('the provider said no');
    });
    await test.job({ maxAttempts: 1 });

    await test.worker().poll();
    await settle();

    const job = await test.read();
    expect(job.status).toBe('dead');
    expect(job.error).toBe('step "work" failed: the provider said no');
    expect(job.history).toMatchObject([
      { attempt: 1, status: 'failed', error: 'step "work" failed: the provider said no' }
    ]);
  });

  it('stops a running job when an operator cancels it', async () => {
    const test = world(
      (_params, ctx) =>
        new Promise((_resolve, reject) => {
          ctx.signal.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );
    await test.job();

    const worker = test.worker({ leaseMs: 60_000 });
    await worker.poll();
    await settle();
    expect(worker.inFlight()).toBe(1);

    expect(await test.queue.cancel([1], jobInput().id)).toBe(true);
    // The flag is read at the next heartbeat, which is what reaches the replica actually running the flow — a
    // cancel almost never lands on the replica holding the job.
    await worker.beat();
    await settle();

    expect((await test.read()).status).toBe('cancelled');
    expect(worker.inFlight()).toBe(0);
  });

  it('drops a waiting job an operator cancels, without running it', async () => {
    const ran = vi.fn(() => ({ ok: true }));
    const test = world(ran);
    await test.job();

    expect(await test.queue.cancel([1], jobInput().id)).toBe(true);
    expect(await test.worker().poll()).toBe(0);
    expect(ran).not.toHaveBeenCalled();
    expect((await test.read()).status).toBe('cancelled');
  });

  it('repeats a finished job when an operator asks, keeping what already happened', async () => {
    const ran = vi.fn(() => ({ ok: true }));
    const test = world(ran);
    await test.job();

    await test.worker().poll();
    await settle();
    expect((await test.read()).status).toBe('succeeded');

    // The dashboard's repeat button: a job that went fine is allowed to go again.
    expect(await test.queue.requeue([1], jobInput().id)).toBe(true);
    expect((await test.read()).status).toBe('pending');

    await test.worker().poll();
    await settle();

    const job = await test.read();
    expect(ran).toHaveBeenCalledTimes(2);
    expect(job.status).toBe('succeeded');
    expect(job.history).toMatchObject([
      { attempt: 1, status: 'succeeded' },
      { attempt: 2, status: 'succeeded' }
    ]);
  });

  it('gives up on a job whose action was deleted, visibly', async () => {
    const test = world(() => ({ ok: true }), []);
    await test.job();

    await test.worker().poll();
    await settle();

    const job = await test.read();
    expect(job.status).toBe('dead');
    expect(job.error).toContain('no longer exists');
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
