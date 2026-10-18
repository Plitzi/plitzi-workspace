import { describe, expect, it } from 'vitest';

import { defineFunctions } from './contract';
import { jobViewOf } from './jobs';
import { createActionsModule } from '../actions';
import { createMemoryJobQueue } from '../actions/jobs/memoryQueue';
import { ActionRefusal } from '../actions/runtime/errors';

import type { FunctionJob } from './contract';
import type { FunctionJobLimits } from './jobs';
import type { RouteVisit } from './routes';
import type { ActionJob, ActionJobStatus, FunctionJobView, SSRUser } from '@plitzi/sdk-shared';

/**
 * Jobs of a server's own functions, the whole way through the module a deployment gets: started by a route, run by the
 * queue's worker slice by slice, set aside and resumed, and said to whoever watches them each time they move.
 */

const SPACE = 1;
const ana = { id: 3, username: 'ana', email: 'ana@example.test', verified: true, permissions: [], roles: [] };

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** A job whose input and saved state are typed: it must still be one of `defineFunctions({ jobs })`. */
const count: FunctionJob<{ to: number }, { at: number }, { counted: number }> = {
  watch: { mode: 'role', permissions: ['jobs.read'] },
  run: async (input, job) => {
    let at = job.state?.at ?? 0;
    while (at < input.to) {
      if (job.signal.aborted) {
        return { counted: at };
      }

      at += 1;
      await job.save({ at });
      job.report(at / input.to, `${String(at)} of ${String(input.to)}`);
      await wait(15);
    }

    return { counted: at };
  }
};

const definition = defineFunctions({
  jobs: {
    count,
    refuse: {
      run: () => {
        throw new ActionRefusal('There is nothing to import yet');
      }
    },
    crash: {
      run: () => {
        throw new Error('the database password is hunter2');
      }
    },
    brief: { maxSeconds: 1, run: () => wait(1_500) },
    hoard: { run: async (_input, job) => job.save('x'.repeat(2_000)) }
  },
  routes: {
    'POST /start/:name': async (request, ctx) => {
      const { input, key } = (await request.json()) as { input?: Record<string, unknown>; key?: string };
      try {
        return Response.json(await ctx.jobs.start(ctx.params.name, input, key ? { key } : {}));
      } catch (error) {
        return Response.json({ refused: error instanceof Error ? error.message : String(error) }, { status: 400 });
      }
    },
    'GET /jobs/:id': async (_request, ctx) => Response.json((await ctx.jobs.get(ctx.params.id)) ?? null),
    'POST /jobs/:id/:verb': async (_request, ctx) => {
      const verb = ctx.params.verb;
      const changed =
        verb === 'pause'
          ? await ctx.jobs.pause(ctx.params.id)
          : verb === 'resume'
            ? await ctx.jobs.resume(ctx.params.id)
            : await ctx.jobs.cancel(ctx.params.id);

      return Response.json({ changed });
    }
  }
});

const world = (limits: Partial<FunctionJobLimits> = {}) => {
  const queue = createMemoryJobQueue();
  const heard: FunctionJobView[] = [];
  const module = createActionsModule({
    lookups: { getAction: () => Promise.resolve(undefined), listActions: () => Promise.resolve([]) },
    functions: { native: [definition], jobs: { limitsFor: () => Promise.resolve(limits) } },
    jobs: { queue, leaseMs: 60_000, maxAttempts: 2, backoff: { baseMs: 10, maxMs: 20 } },
    realtime: {
      publish: () => Promise.resolve(),
      grant: () => Promise.resolve('grant'),
      revoke: () => Promise.resolve(),
      publishJob: (_space, _id, view) => {
        heard.push(view);

        return Promise.resolve();
      }
    }
  });
  const jobs = module.jobs;
  if (!jobs) {
    throw new Error('The module runs no jobs');
  }

  const user: SSRUser = { ...ana, token: 'session' };
  const visit = (): RouteVisit => ({
    spaceId: SPACE,
    environment: 'main',
    callerId: `user:${String(user.id)}`,
    user,
    signal: new AbortController().signal
  });
  const call = async (method: string, path: string, body?: unknown): Promise<unknown> => {
    const route = await module.routeFor(visit(), method, path);
    if (!route) {
      throw new Error(`No route answers ${method} ${path}`);
    }

    const answer = await route.handle(
      new Request(`https://space.example.test/fn${path}`, {
        method,
        ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
      })
    );

    return answer.json();
  };
  const start = async (name: string, input: Record<string, unknown> = {}, key?: string) =>
    (await call('POST', `/start/${name}`, { input, ...(key ? { key } : {}) })) as FunctionJobView & {
      refused?: string;
    };
  /** The job, once it is in `status` — the worker polled (and beating) meanwhile, as a replica's loop does. */
  const until = async (id: string, status: ActionJobStatus): Promise<ActionJob> => {
    for (let round = 0; round < 200; round += 1) {
      const job = await queue.getJob([SPACE], id);
      if (job?.status === status) {
        return job;
      }

      await jobs.worker.poll();
      await jobs.worker.beat();
      await wait(10);
    }

    throw new Error(`Job ${id} never became ${status}: it is ${String((await queue.getJob([SPACE], id))?.status)}`);
  };

  return { queue, heard, jobs, call, start, until };
};

describe('a job of the functions', () => {
  it('runs to its answer, telling whoever watches how far it is each time it moves', async () => {
    const { start, until, heard, call } = world();
    const started = await start('count', { to: 3 });
    expect(started).toMatchObject({ name: 'count', status: 'pending' });

    const job = await until(started.id, 'succeeded');
    expect(job).toMatchObject({
      result: { counted: 3 },
      state: { at: 3 },
      function: { user: { id: 3 }, watch: { mode: 'role', permissions: ['jobs.read'] } }
    });
    expect(heard.map(view => view.status)).toEqual(expect.arrayContaining(['pending', 'running', 'succeeded']));
    expect(heard.some(view => view.progress === 1 && view.step === '3 of 3')).toBe(true);
    expect(heard.at(-1)).toMatchObject({ status: 'succeeded', result: { counted: 3 } });
    expect(await call('GET', `/jobs/${started.id}`)).toMatchObject({ status: 'succeeded', result: { counted: 3 } });
  });

  it('is set aside once its code saved, and goes on from there when resumed', async () => {
    const { start, until, call, queue, jobs } = world();
    const { id } = await start('count', { to: 40 });
    await jobs.worker.poll();
    await wait(60);

    expect(await call('POST', `/jobs/${id}/pause`)).toEqual({ changed: true });
    const paused = await until(id, 'paused');
    const savedAt = (paused.state as { at: number }).at;
    expect(savedAt).toBeGreaterThan(0);
    expect(savedAt).toBeLessThan(40);
    expect(paused.attempts).toBe(0);

    expect(await call('POST', `/jobs/${id}/resume`)).toEqual({ changed: true });
    expect((await until(id, 'succeeded')).result).toEqual({ counted: 40 });
    // The history says it was set aside once, and finished once — not that it was tried twice.
    expect((await queue.getJob([SPACE], id))?.history.map(attempt => attempt.status)).toEqual(['paused', 'succeeded']);
  });

  it('is cancelled, waiting or running', async () => {
    const { start, until, call, jobs } = world();
    const waiting = await start('count', { to: 5 });
    expect(await call('POST', `/jobs/${waiting.id}/cancel`)).toEqual({ changed: true });
    expect((await until(waiting.id, 'cancelled')).history).toEqual([]);

    const running = await start('count', { to: 40 });
    await jobs.worker.poll();
    await wait(40);
    expect(await call('POST', `/jobs/${running.id}/cancel`)).toEqual({ changed: true });
    expect((await until(running.id, 'cancelled')).history.at(-1)?.status).toBe('cancelled');
  });

  it('fails a refusal at once, saying it; any other error is tried again and kept from whoever watches', async () => {
    const { start, until, heard } = world();
    const refused = await until((await start('refuse')).id, 'failed');
    expect(refused.attempts).toBe(1);
    expect(heard.at(-1)).toMatchObject({ status: 'failed', error: 'There is nothing to import yet' });

    const crashed = await until((await start('crash')).id, 'dead');
    expect(crashed.history.map(attempt => attempt.status)).toEqual(['failed', 'failed']);
    expect(crashed.error).toBe('the database password is hunter2');
    expect(jobViewOf(crashed).error).toBe('The job failed');
    expect(heard.at(-1)).toMatchObject({ status: 'dead', error: 'The job failed' });
  });

  it('runs no longer than it may, every slice together', async () => {
    const { start, until } = world();
    const job = await until((await start('brief')).id, 'failed');

    expect(job.error).toBe('ran for 1 s, the most a job may');
  });

  it('keeps one job per key: a second start answers the one under way, and one that ended starts over', async () => {
    const { start, until } = world();
    const first = await start('count', { to: 2 }, 'model-7');
    const again = await start('count', { to: 9 }, 'model-7');
    expect(again.id).toBe(first.id);

    await until(first.id, 'succeeded');
    const over = await start('count', { to: 1 }, 'model-7');
    expect(over).toMatchObject({ id: first.id, status: 'pending' });
    expect(over.result).toBeUndefined();
    expect((await until(first.id, 'succeeded')).result).toEqual({ counted: 1 });
  });

  it('refuses what it cannot keep, saying what to do instead', async () => {
    const { start } = world({ waiting: 1, stateBytes: 1_000 });
    expect((await start('nope')).refused).toBe('No job "nope": this code declares count, refuse, crash, brief, hoard');
    expect((await start('count', { blob: 'x'.repeat(2_000) })).refused).toMatch(/over the 1000 a job keeps/);
    await start('count', { to: 1 });
    expect((await start('count', { to: 1 })).refused).toBe(
      'This space has 1 jobs waiting, the most it may: let some of them finish first'
    );

    const small = world({ stateBytes: 1_000 });
    const hoard = await small.until((await small.start('hoard')).id, 'dead');
    expect(hoard.error).toMatch(/^job\.save: the state is 2002 bytes, over the 1000 a job keeps/);
  });

  it('waits while its account runs as many jobs as it may', async () => {
    const { start, queue, jobs } = world({ running: 1 });
    const first = await start('count', { to: 30 });
    // Started at another instant: of two started together, which goes first is the order of their ids.
    await wait(5);
    const second = await start('count', { to: 1 });
    await jobs.worker.poll();
    await wait(30);

    expect((await queue.getJob([SPACE], first.id))?.status).toBe('running');
    const held = await queue.getJob([SPACE], second.id);
    expect(held).toMatchObject({ status: 'pending', attempts: 0 });
    expect(held?.error).toMatch(/^waiting: 1 jobs of this account run at once/);
    await jobs.stop();
  });

  it('hands a slice back when its server stops, for another to go on from what it saved', async () => {
    const { start, queue, jobs } = world();
    const { id } = await start('count', { to: 200 });
    await jobs.worker.poll();
    await wait(60);
    await jobs.stop();

    const handed = await queue.getJob([SPACE], id);
    expect(handed).toMatchObject({ status: 'pending', attempts: 0 });
    expect((handed?.state as { at: number }).at).toBeGreaterThan(0);
  });
});
