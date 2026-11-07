import { describe, expect, it, vi } from 'vitest';

import { serverLog } from '@plitzi/sdk-kernel/log';
import { ActionRefusal } from '@plitzi/sdk-shared/functions';

import { keepCall, readKeptCall } from './calls';
import { createMemoryJobQueue } from './memoryQueue';
import { createJobWorker } from './worker';
import { tasksOf } from '../../functions/tests/tasksOf';
import { createActionsModule } from '../module';

import type { ActionEntry, JobInput, ElementInteraction } from '@plitzi/sdk-shared';
import type { FunctionTask } from '@plitzi/sdk-shared/functions';

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

const jobInput = (over: Partial<JobInput> = {}): JobInput => ({
  id: `schedule:1:digest:${MIDNIGHT}`,
  spaceId: 1,
  environment: 'main',
  target: { kind: 'action', name: 'digest', trigger: 'schedule' },
  input: {},
  dueAt: MIDNIGHT,
  maxAttempts: 3,
  ...over
});

/** One queue, one module, and a task the test drives. */
const world = (run: FunctionTask['run'], entries = [entry()]) => {
  let now = MIDNIGHT;
  const queue = createMemoryJobQueue({ clock: () => now });
  const lookups = {
    getAction: (_spaceId: number, actionId: string) => Promise.resolve(entries.find(item => item.id === actionId)),
    listActions: () => Promise.resolve(entries)
  };
  const task: FunctionTask = { namespace: 'test', action: 'work', title: 'Work', params: {}, run };
  // `jobs: false` so the module builds no scheduler of its own; the test drives the worker directly.
  const module = createActionsModule({ lookups, functions: tasksOf(task), jobs: false });

  return {
    queue,
    module,
    lookups,
    advance: (ms: number) => {
      now += ms;
    },
    worker: (over: Parameters<typeof createJobWorker>[0] extends infer T ? Partial<T> : never = {}) =>
      createJobWorker({ queue, lookups, module, pollMs: 5, leaseMs: 1_000, onError: () => {}, ...over }),
    job: async (over: Partial<JobInput> = {}) => {
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

  // A worker that took its job's memory with it: the job runs next on a larger one, which says so, not on its twin.
  it('marks what it runs near its memory, once, and a larger worker runs it after this one dies', async () => {
    const warn = vi.spyOn(serverLog, 'warn').mockImplementation(() => undefined);
    // A run that never answers: the worker the kernel is about to end.
    const test = world(() => new Promise(() => {}));
    await test.job();
    const small = () => ({ mb: 512, ceilingMb: 1024 });
    let rssMb = 200;
    const holder = test.worker({
      workerId: 'pod-small',
      memory: small,
      readMemory: () => ({ rssMb, heapUsedMb: 120, heapLimitMb: 259 })
    });
    expect(await holder.poll()).toBe(1);
    await settle();

    await holder.watchMemory();
    expect((await test.read()).nearMemoryLimit ?? null).toBeNull();
    rssMb = 470;
    await holder.watchMemory();
    await holder.watchMemory();
    expect((await test.read()).nearMemoryLimit).toBe(true);
    expect(
      warn.mock.calls.filter(([, said]) => typeof said === 'string' && said.includes('near its memory (470 of 512 MiB'))
    ).toHaveLength(1);

    test.advance(2_000);
    expect(await test.worker({ workerId: 'pod-twin', memory: small }).poll()).toBe(0);
    expect(await test.worker({ workerId: 'pod-large', memory: () => ({ mb: 1024, ceilingMb: 1024 }) }).poll()).toBe(1);
    await settle();

    // Taken by the larger one; its run is refused here only by the dead one's single-flight key, which its process
    // would have taken with it (asserted in the queue, as the takeover above is).
    expect(await test.read()).toMatchObject({
      holderMemoryMb: 1024,
      needsMemoryMb: 513,
      history: [{ status: 'lost', workerId: 'pod-small', memoryMb: 512, nearMemoryLimit: true }]
    });
    expect(warn).toHaveBeenCalledWith('Actions', expect.stringContaining('a worker died running it'));
    warn.mockRestore();
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
    // Out of attempts, it waits for somebody to read its runs: resumed once fixed, or cancelled.
    expect(job.status).toBe('paused');
    expect(job.error).toMatch(/^Set aside after 2 failed attempts: look at its runs/);
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
    expect(job.status).toBe('paused');
    expect(job.error).toContain('The last said: step "work" failed: the provider said no');
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

/**
 * What a replica does when it is told to go — a deploy, a scale-down, a restart.
 *
 * One rule: the job it is RUNNING is finished here, and nothing else is. What is still waiting belongs to the queue the
 * replicas share, for whichever of them is running next — the one staying, or the one this deploy starts.
 */
describe('stopping a worker', () => {
  /** A run the test finishes when it says so, and a way to know it has started. */
  const gated = () => {
    let finish: () => void = () => {};
    let started: () => void = () => {};
    const running = new Promise<void>(resolve => {
      started = resolve;
    });
    const run = vi.fn(async () => {
      started();
      await new Promise<void>(resolve => {
        finish = resolve;
      });

      return { ok: true };
    });

    return { run, running, finish: () => finish() };
  };

  it('finishes the job it is running before it stops', async () => {
    const gate = gated();
    const test = world(gate.run);
    await test.job();

    const worker = test.worker({ workerId: 'pod-a', leaseMs: 60_000 });
    worker.start();
    await gate.running;

    let stopped = false;
    const stopping = worker.stop().then(() => {
      stopped = true;
    });
    await settle();
    expect(stopped).toBe(false);
    expect((await test.read()).status).toBe('running');

    gate.finish();
    await stopping;

    const job = await test.read();
    expect(job.status).toBe('succeeded');
    // Finished where it started: one attempt, no lost one for another replica to have picked up.
    expect(job.history).toMatchObject([{ attempt: 1, status: 'succeeded', workerId: 'pod-a' }]);
  });

  /**
   * The half that makes waiting safe. A job longer than its lease used to lose its claim the moment the drain began,
   * and another replica ran it again while this one was still finishing it.
   */
  it('keeps renewing its claim while it drains, so no other replica takes the job over', async () => {
    const gate = gated();
    const test = world(gate.run);
    await test.job();

    // The shortest heartbeat the worker keeps is one second, whatever the lease: a real second has to pass. Waited
    // for as the beat itself rather than a sleep a little longer, which a busy CI runner's late timer outlasts.
    const beat = vi.spyOn(test.queue, 'heartbeat');
    const worker = test.worker({ workerId: 'pod-a', leaseMs: 1_000 });
    worker.start();
    await gate.running;
    const stopping = worker.stop();

    // The lease it was claimed with runs out while it drains…
    test.advance(900);
    const beatsBefore = beat.mock.calls.length;
    await vi.waitFor(() => expect(beat.mock.calls.length).toBeGreaterThan(beatsBefore), { timeout: 4_000 });
    await beat.mock.results.at(-1)?.value;
    test.advance(900);

    // …and the heartbeat has moved it on, so a replica that is staying finds nothing to take.
    expect(await test.queue.claim({ workerId: 'pod-b', leaseMs: 1_000, limit: 5 })).toEqual([]);

    gate.finish();
    await stopping;

    expect((await test.read()).history).toMatchObject([{ attempt: 1, status: 'succeeded', workerId: 'pod-a' }]);
  });

  it('leaves what is still waiting in the queue, for the replica that runs next', async () => {
    const gate = gated();
    const test = world(gate.run);
    await test.job({ id: 'first' });
    await test.job({ id: 'second' });

    // One slot: it runs one job and the other waits behind it.
    const worker = test.worker({ workerId: 'pod-a', workers: 1, leaseMs: 60_000 });
    worker.start();
    await gate.running;
    const stopping = worker.stop();
    gate.finish();
    await stopping;

    const jobs = [await test.read('first'), await test.read('second')];
    const ran = jobs.filter(job => job.status === 'succeeded');
    const waiting = jobs.filter(job => job.status !== 'succeeded');
    expect(ran).toHaveLength(1);
    expect(waiting).toMatchObject([{ status: 'pending', attempts: 0, history: [] }]);

    // Untouched, and there for the next replica to take.
    const [taken] = await test.queue.claim({ workerId: 'pod-new', leaseMs: 60_000, limit: 5 });
    expect(taken.id).toBe(waiting[0].id);
  });

  it('hands back a job it claimed while being told to stop, without running it', async () => {
    const ran = vi.fn(() => ({ ok: true }));
    const test = world(ran);
    await test.job();

    // A claim that is still on its way when the stop arrives.
    let release: () => void = () => {};
    const claiming = new Promise<void>(resolve => {
      release = resolve;
    });
    let asked: () => void = () => {};
    const askedToClaim = new Promise<void>(resolve => {
      asked = resolve;
    });
    const claim = test.queue.claim;
    test.queue.claim = async options => {
      asked();
      await claiming;

      return claim(options);
    };

    const worker = test.worker({ workerId: 'pod-a', leaseMs: 60_000 });
    worker.start();
    await askedToClaim;
    const stopping = worker.stop();
    release();
    await stopping;

    expect(ran).not.toHaveBeenCalled();
    // Given back as it was: waiting, its attempt refunded, nothing written against it.
    expect(await test.read()).toMatchObject({ status: 'pending', attempts: 0, history: [] });
  });
});

describe('a call kept in the queue', () => {
  const callEntry: ActionEntry = {
    id: 'greet',
    document: {
      name: 'greet',
      output: { who: { type: 'json' } },
      nodes: {
        start: node('start', { type: 'trigger', action: 'call', params: { access: 'session' }, afterNode: 'work' }),
        work: node('work', { action: 'test.work', afterNode: 'ret' }),
        ret: node('ret', { action: 'flow.output', params: { values: '{"who": {{ work|json_encode }}}' } })
      }
    }
  };
  const ana = { id: 7, username: 'ana', email: 'ana@example.com', verified: true, permissions: [], roles: [] };

  it('runs as the visitor who made it, and keeps its answer for them alone', async () => {
    const test = world((_params, ctx) => ctx.user?.email ?? 'nobody', [callEntry]);
    const kept = await keepCall(test.queue, {
      spaceId: 1,
      environment: 'main',
      actionId: 'greet',
      input: {},
      user: ana,
      callerId: 'user:7'
    });
    if ('refused' in kept) {
      throw new Error(kept.refused);
    }

    expect(await readKeptCall(test.queue, 1, kept.jobId, kept.ticket)).toMatchObject({ status: 'queued' });
    // Kept by the real clock: the queue's is brought up to it.
    test.advance(Date.now() - MIDNIGHT);
    expect(await test.worker().poll()).toBe(1);
    await settle();

    expect(await readKeptCall(test.queue, 1, kept.jobId, kept.ticket)).toMatchObject({
      status: 'completed',
      output: { who: 'ana@example.com' }
    });
    // Another ticket reads nothing: the answer is the caller's.
    expect(await readKeptCall(test.queue, 1, kept.jobId, 'not-the-ticket')).toBeUndefined();
  });

  it('is the same call asked again under the same key, and nobody else’s', async () => {
    const test = world(() => 'ok', [callEntry]);
    const call = {
      spaceId: 1,
      environment: 'main' as const,
      actionId: 'greet',
      input: {},
      user: ana,
      callerId: 'user:7',
      idempotencyKey: 'submit-1'
    };
    const first = await keepCall(test.queue, call);
    const again = await keepCall(test.queue, call);
    const stranger = await keepCall(test.queue, { ...call, callerId: 'user:8' });

    expect(again).toEqual(first);
    // A different caller under the same key is a different call: kept on its own, never handed the first one's ticket.
    expect('refused' in stranger || ('jobId' in first && stranger.jobId !== first.jobId)).toBe(true);
  });

  it('answers a refusal once, never running it again', async () => {
    const test = world(() => Promise.reject(new ActionRefusal('No more seats')), [callEntry]);
    const kept = await keepCall(test.queue, {
      spaceId: 1,
      environment: 'main',
      actionId: 'greet',
      input: {},
      user: ana,
      callerId: 'user:7'
    });
    if ('refused' in kept) {
      throw new Error(kept.refused);
    }

    test.advance(Date.now() - MIDNIGHT);
    await test.worker().poll();
    await settle();

    expect(await readKeptCall(test.queue, 1, kept.jobId, kept.ticket)).toMatchObject({
      status: 'failed',
      error: 'No more seats'
    });
    expect((await test.read(kept.jobId)).status).toBe('failed');
  });
});
