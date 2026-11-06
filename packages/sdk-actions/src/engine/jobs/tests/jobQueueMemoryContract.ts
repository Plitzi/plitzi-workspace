import { expect, it } from 'vitest';

import type { JobQueue } from '../../../types';
import type { JobInput } from '@plitzi/sdk-shared';

/** What the memory half of the job queue contract reads of the contract around it. */
export type MemoryNeedsSubject = {
  queue: () => JobQueue;
  job: (over?: Partial<JobInput>) => Promise<JobInput>;
  wait: (ms: number) => Promise<unknown>;
  space: number;
  otherSpace: number;
};

/**
 * The job queue contract's rules for a job a worker died running (`JobClaimMemory`), run inside `describeJobQueue`
 * against each store: it waits for a worker that may hold more, and is set aside when none may.
 */
export const describeMemoryNeeds = (ctx: MemoryNeedsSubject): void => {
  const small = { mb: 512, ceilingMb: 1024 };
  const large = { mb: 1024, ceilingMb: 1024 };

  /** A worker that claims the job, says it neared its memory when asked to, and dies: its lease left to lapse. */
  const diesHolding = async (workerId: string, memory: typeof small, near: boolean) => {
    const [held] = await ctx.queue().claim({ workerId, leaseMs: 40, limit: 1, memory });
    if (near) {
      await ctx.queue().heartbeat({ jobIds: [held.id], workerId, leaseMs: 40, nearMemoryLimit: true });
    }

    await ctx.wait(150);
  };

  // A node lost, a deploy past its grace: the job did not take its worker down, and the next of any size runs it.
  it('runs a job whose worker died for another reason on the next worker, whatever its size', async () => {
    await ctx.queue().enqueue(await ctx.job());
    await diesHolding('pod-a', small, false);

    const [taken] = await ctx.queue().claim({ workerId: 'pod-b', leaseMs: 60_000, limit: 1, memory: small });
    expect(taken).toMatchObject({ id: 'job-1', workerId: 'pod-b', attempts: 2, holderMemoryMb: 512 });
    expect(taken.needsMemoryMb ?? null).toBeNull();
    expect(taken.history).toMatchObject([{ status: 'lost', workerId: 'pod-a', memoryMb: 512 }]);
  });

  // Run again on a worker of the same size, a job that took its worker down with it takes the next one down too.
  it('moves a job whose worker died near its memory to one that may hold more, whatever its spaces', async () => {
    await ctx.queue().enqueue(await ctx.job());
    await diesHolding('pod-a', small, true);

    expect(await ctx.queue().claim({ workerId: 'pod-b', leaseMs: 60_000, limit: 1, memory: small })).toEqual([]);
    const waiting = await ctx.queue().getJob([ctx.space], 'job-1');
    expect(waiting).toMatchObject({
      status: 'pending',
      needsMemoryMb: 513,
      history: [{ attempt: 1, status: 'lost', workerId: 'pod-a', memoryMb: 512, nearMemoryLimit: true }]
    });
    expect(waiting?.error).toContain('near its memory — it could hold 512 MiB');
    expect((await ctx.queue().summarize()).needingMemory).toEqual({ waiting: 1, paused: 0, mostMb: 513 });

    const [taken] = await ctx.queue().claim({
      workerId: 'pod-large',
      leaseMs: 60_000,
      limit: 1,
      spaces: { only: [ctx.otherSpace] },
      memory: large
    });
    expect(taken).toMatchObject({ id: 'job-1', workerId: 'pod-large', holderMemoryMb: 1024, attempts: 2 });
    expect(taken.nearMemoryLimit ?? null).toBeNull();
  });

  // A spike between two samples says nothing; a second worker in a row taken down by the same job says it for it.
  it('moves a job a second worker in a row died running to a larger one', async () => {
    await ctx.queue().enqueue(await ctx.job());
    await diesHolding('pod-a', small, false);
    await diesHolding('pod-b', small, false);

    expect(await ctx.queue().claim({ workerId: 'pod-c', leaseMs: 60_000, limit: 1, memory: small })).toEqual([]);
    expect(await ctx.queue().getJob([ctx.space], 'job-1')).toMatchObject({ status: 'pending', needsMemoryMb: 513 });
  });

  // What an autoscaler reads: the work a claim would take now, so a pool grows with what waits for it.
  it('counts what a claim would take now: due, of its spaces, and what it may hold', async () => {
    const at = (await ctx.queue().now()).getTime();
    await ctx.queue().enqueue(await ctx.job({ id: 'due-1' }));
    await ctx.queue().enqueue(await ctx.job({ id: 'due-2' }));
    await ctx.queue().enqueue(await ctx.job({ id: 'other', spaceId: ctx.otherSpace }));
    await ctx.queue().enqueue(await ctx.job({ id: 'later', dueAt: at + 60_000 }));

    expect(await ctx.queue().countDue()).toBe(3);
    expect(await ctx.queue().countDue({ spaces: { only: [ctx.space] } })).toBe(2);
    expect(await ctx.queue().countDue({ spaces: { except: [ctx.space] } })).toBe(1);

    await ctx
      .queue()
      .claim({ workerId: 'pod-a', leaseMs: 40, limit: 1, spaces: { only: [ctx.otherSpace] }, memory: small });
    await ctx.queue().heartbeat({ jobIds: ['other'], workerId: 'pod-a', leaseMs: 40, nearMemoryLimit: true });
    await ctx.wait(150);
    // Reaped by the next claim, it waits for a larger worker: counted for one, not for its twin.
    await ctx.queue().claim({ workerId: 'pod-b', leaseMs: 60_000, limit: 0, memory: small });
    expect(await ctx.queue().countDue({ spaces: { only: [ctx.otherSpace] }, memoryMb: 512 })).toBe(0);
    expect(await ctx.queue().countDue({ spaces: { only: [] }, memoryMb: 1024 })).toBe(1);
  });

  it('sets a job aside when no worker may hold what it needs, saying so, and resumes it on a larger one', async () => {
    await ctx.queue().enqueue(await ctx.job());
    await diesHolding('pod-large', large, true);

    expect(await ctx.queue().claim({ workerId: 'pod-large-2', leaseMs: 60_000, limit: 1, memory: large })).toEqual([]);
    const setAside = await ctx.queue().getJob([ctx.space], 'job-1');
    expect(setAside).toMatchObject({ status: 'paused', needsMemoryMb: 1025 });
    expect(setAside?.error).toContain('the largest worker here may hold 1024 MiB');
    expect((await ctx.queue().summarize()).needingMemory).toEqual({ waiting: 0, paused: 1 });

    // Resumed while no worker may hold it yet, it is set aside again at the next claim rather than waiting unseen.
    expect(await ctx.queue().resume([ctx.space], 'job-1')).toBe(true);
    expect(await ctx.queue().claim({ workerId: 'pod-large-2', leaseMs: 60_000, limit: 1, memory: large })).toEqual([]);
    expect(await ctx.queue().getJob([ctx.space], 'job-1')).toMatchObject({ status: 'paused' });

    expect(await ctx.queue().resume([ctx.space], 'job-1')).toBe(true);
    expect(
      await ctx
        .queue()
        .claim({ workerId: 'pod-larger', leaseMs: 60_000, limit: 1, memory: { mb: 2048, ceilingMb: 2048 } })
    ).toMatchObject([{ id: 'job-1', holderMemoryMb: 2048 }]);
  });
};
