import { afterEach, describe, expect, it, vi } from 'vitest';

import { serverLog } from '@plitzi/sdk-kernel/log';

import { limitSetAsideError } from './endings';
import { createMemoryJobQueue } from './memoryQueue';
import { createScheduler } from './scheduler';
import { schedulesFor } from './schedules';

import type { JobQueue } from '../../types';
import type { ActionEntry, ElementInteraction } from '@plitzi/sdk-shared';

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

const scheduled = (cron: string, enabled = true, id = 'digest'): ActionEntry => ({
  id,
  document: {
    name: id,
    nodes: {
      start: node('start', { type: 'trigger', action: 'schedule', params: { cron }, enabled, afterNode: 'out' }),
      out: node('out', { action: 'flow.output', params: { values: '{"ok": true}' } })
    }
  }
});

const MIDNIGHT = Date.parse('2026-03-01T00:00:00Z');

// A test that fails half-way must not leave its spies or its clock to the next one.
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** A cluster: one queue, and as many schedulers over it as a test wants. */
const cluster = (entries: ActionEntry[]) => {
  let now = MIDNIGHT;
  const queue = createMemoryJobQueue({ clock: () => now });
  const lookups = {
    getAction: () => Promise.resolve(undefined),
    listActions: () => Promise.resolve(entries),
    listScheduledSpaces: () => Promise.resolve([1])
  };

  return {
    queue,
    lookups,
    at: (iso: string) => {
      now = Date.parse(iso);
    },
    replica: (over: JobQueue = queue) => createScheduler({ queue: over, lookups })
  };
};

const seed = async (world: ReturnType<typeof cluster>) => {
  await world.replica().reconcile(1);
};

describe('createScheduler', () => {
  it('turns a due schedule into one job, and leaves it alone until it is due', async () => {
    const world = cluster([scheduled('30 0 * * *')]);
    await seed(world);

    expect((await world.replica().sweep()).enqueued).toEqual([]);

    world.at('2026-03-01T00:30:00Z');
    const fired = await world.replica().sweep();
    expect(fired.enqueued).toEqual([`schedule:1:digest:${Date.parse('2026-03-01T00:30:00Z')}`]);

    // The same minute swept again produces nothing: the schedule has moved on to tomorrow.
    expect((await world.replica().sweep()).enqueued).toEqual([]);
    const [schedule] = await world.queue.listSchedules([1]);
    expect(new Date(schedule.nextRunAt).toISOString()).toBe('2026-03-02T00:30:00.000Z');
  });

  // A nightly job that takes a small worker down each night would take one down every night: it starts on a larger one.
  it('starts a fire on the larger worker the fire before it needed', async () => {
    const world = cluster([scheduled('30 0 * * *')]);
    await seed(world);
    world.at('2026-03-01T00:30:00Z');
    const [first] = (await world.replica().sweep()).enqueued;
    const small = { mb: 512, ceilingMb: 1024 };
    await world.queue.claim({ workerId: 'pod-a', leaseMs: 1_000, limit: 1, memory: small });
    await world.queue.heartbeat({ jobIds: [first], workerId: 'pod-a', leaseMs: 1_000, nearMemoryLimit: true });
    world.at('2026-03-01T00:31:00Z');
    await world.queue.claim({ workerId: 'pod-b', leaseMs: 1_000, limit: 1, memory: small });

    world.at('2026-03-02T00:30:00Z');
    const [second] = (await world.replica().sweep()).enqueued;
    expect(await world.queue.getJob([1], second)).toMatchObject({ status: 'pending', needsMemoryMb: 513 });
  });

  /** A fire claimed and ended as a worker ends one stopped at a limit its plan sets. */
  const setAside = async (world: ReturnType<typeof cluster>, jobId: string, limit: 'memory' | 'cpu' | 'quota') => {
    await world.queue.claim({ workerId: 'pod-a', leaseMs: 60_000, limit: 1 });
    const said = `Went over its ${limit}`;
    await world.queue.settle({
      jobId,
      workerId: 'pod-a',
      status: 'paused',
      error: limitSetAsideError(said),
      attempt: { status: 'failed', workerId: 'pod-a', error: said, limit }
    });
  };

  /** The first fire of a schedule, set aside at a limit. */
  const setAsideAt = async (world: ReturnType<typeof cluster>, limit: 'memory' | 'cpu' | 'quota'): Promise<string> => {
    const [first] = (await world.replica().sweep()).enqueued;
    await setAside(world, first, limit);

    return first;
  };

  const setAsideJobs = async (world: ReturnType<typeof cluster>): Promise<string[]> =>
    (await world.queue.listJobs({ spaceIds: [1], status: 'paused', limit: 100, offset: 0 })).jobs.map(job => job.id);

  // A run stopped at a limit its plan sets meets it again at the next fire. A sweep that needed more memory than a
  // small task has was one more job set aside every minute — thirty an hour, each a failed run — for nobody to resume.
  it('waits on a fire set aside at a limit instead of firing into it again', async () => {
    const world = cluster([scheduled('* * * * *')]);
    await seed(world);
    world.at('2026-03-01T00:01:00Z');
    const first = await setAsideAt(world, 'memory');

    for (const minute of ['02', '03', '04', '30']) {
      world.at(`2026-03-01T00:${minute}:00Z`);
      const pass = await world.replica().sweep();

      expect(pass.enqueued).toEqual([]);
      expect(pass.held).toEqual([{ spaceId: 1, actionId: 'digest', jobId: first, limit: 'memory' }]);
    }

    // One job waits for somebody, not one a minute; and the schedule kept its place — nothing to replay afterwards.
    expect((await world.queue.listJobs({ spaceIds: [1], limit: 10, offset: 0 })).total).toBe(1);
    const [schedule] = await world.queue.listSchedules([1]);

    expect(new Date(schedule.nextRunAt).toISOString()).toBe('2026-03-01T00:31:00.000Z');
    // The last fire made into a job is still the one it waits on: the fires held back since were not.
    expect(first).toBe(`schedule:1:digest:${String(schedule.lastFireAt)}`);
  });

  it('fires again once the job it waited on is resumed, or cancelled', async () => {
    for (const release of ['resume', 'cancel'] as const) {
      const world = cluster([scheduled('* * * * *')]);
      await seed(world);
      world.at('2026-03-01T00:01:00Z');
      const first = await setAsideAt(world, 'memory');
      world.at('2026-03-01T00:02:00Z');

      expect((await world.replica().sweep()).enqueued).toEqual([]);
      await world.queue[release]([1], first);
      world.at('2026-03-01T00:03:00Z');

      expect((await world.replica().sweep()).enqueued, release).toEqual([
        `schedule:1:digest:${Date.parse('2026-03-01T00:03:00Z')}`
      ]);
    }
  });

  // Nobody may be watching: what a run holds can depend on the day's data, and a schedule held for ever by one large
  // day would be a feed that never came back. Once a day it is tried again — one run, not one a minute.
  it('tries a held schedule again once a day', async () => {
    const world = cluster([scheduled('* * * * *')]);
    await seed(world);
    world.at('2026-03-01T00:01:00Z');
    const first = await setAsideAt(world, 'memory');
    const [held] = await world.queue.listSchedules([1]);
    const firedAt = held.lastFireAt ?? 0;
    world.at(new Date(firedAt + 23 * 60 * 60_000).toISOString());

    expect((await world.replica().sweep()).enqueued).toEqual([]);
    world.at(new Date(firedAt + 24 * 60 * 60_000 + 30_000).toISOString());

    // One run, of the fire then due, which takes the place of the one set aside: that one is cancelled, not kept
    // beside it — set aside too, this would otherwise be one more job waiting for ever, a day.
    const again = await world.replica().sweep();
    expect(again.enqueued).toHaveLength(1);
    expect(again.superseded).toEqual([first]);
    expect(await world.queue.getJob([1], first)).toMatchObject({ status: 'cancelled' });
    await setAside(world, again.enqueued[0], 'memory');
    expect(await setAsideJobs(world)).toEqual(again.enqueued);
  });

  // A space past its plan's allowance had every fire refused and set aside: a job a minute for the rest of the period —
  // forty thousand a month — none of which anybody resumes, and none of which expires.
  it('waits on a fire that spent its plan’s allowance, and asks again by itself an hour apart', async () => {
    const world = cluster([scheduled('* * * * *')]);
    await seed(world);
    world.at('2026-03-01T00:01:00Z');
    let waitsOn = await setAsideAt(world, 'quota');

    for (const hour of ['01', '02', '03']) {
      for (const minute of ['02', '30', '59']) {
        world.at(`2026-03-01T${hour === '01' ? '00' : hour === '02' ? '01' : '02'}:${minute}:00Z`);
        const pass = await world.replica().sweep();

        expect(pass.enqueued).toEqual([]);
        expect(pass.held).toEqual([{ spaceId: 1, actionId: 'digest', jobId: waitsOn, limit: 'quota' }]);
      }

      // The hour is up: one fire asks again, and refused too it stands in for the one before — never two set aside.
      world.at(`2026-03-01T${hour}:01:30Z`);
      const asked = await world.replica().sweep();
      expect(asked.enqueued).toHaveLength(1);
      expect(asked.superseded).toEqual([waitsOn]);
      [waitsOn] = asked.enqueued;
      await setAside(world, waitsOn, 'quota');
      expect(await setAsideJobs(world)).toEqual([waitsOn]);
    }
  });

  // A worker died running it and no worker here may hold what it needs: the next fire starts at that need, and was set
  // aside as it was claimed — a job a fire.
  it('waits on a fire no worker here may hold', async () => {
    const world = cluster([scheduled('* * * * *')]);
    await seed(world);
    world.at('2026-03-01T00:01:00Z');
    const [first] = (await world.replica().sweep()).enqueued;
    const largest = { mb: 512, ceilingMb: 512 };
    await world.queue.claim({ workerId: 'pod-a', leaseMs: 1_000, limit: 1, memory: largest });
    await world.queue.heartbeat({ jobIds: [first], workerId: 'pod-a', leaseMs: 1_000, nearMemoryLimit: true });
    world.at('2026-03-01T00:01:30Z');
    await world.queue.claim({ workerId: 'pod-b', leaseMs: 1_000, limit: 1, memory: largest });
    expect(await world.queue.getJob([1], first)).toMatchObject({ status: 'paused', needsMemoryMb: 513 });

    for (const minute of ['02', '03', '45']) {
      world.at(`2026-03-01T00:${minute}:00Z`);
      const pass = await world.replica().sweep();

      expect(pass.enqueued).toEqual([]);
      expect(pass.held).toEqual([{ spaceId: 1, actionId: 'digest', jobId: first, limit: 'memory' }]);
    }

    expect(await setAsideJobs(world)).toEqual([first]);
  });

  // A run that failed every attempt may pass the next time, so the schedule goes on — and the fire that goes takes the
  // place of the one set aside: an API down for a day was a job set aside a minute, each kept for ever.
  it('fires past one that failed every attempt, which the next fire stands in for', async () => {
    const world = cluster([scheduled('* * * * *')]);
    await seed(world);
    world.at('2026-03-01T00:01:00Z');
    let [latest] = (await world.replica().sweep()).enqueued;

    for (const minute of ['02', '03', '04', '05']) {
      await world.queue.claim({ workerId: 'pod-a', leaseMs: 60_000, limit: 1 });
      await world.queue.settle({
        jobId: latest,
        workerId: 'pod-a',
        status: 'paused',
        error: 'Set aside after 3 failed attempts',
        attempt: { status: 'failed', workerId: 'pod-a', error: 'the API answered 503' }
      });
      world.at(`2026-03-01T00:${minute}:00Z`);
      const pass = await world.replica().sweep();

      expect(pass.held).toEqual([]);
      expect(pass.superseded).toEqual([latest]);
      expect(await world.queue.getJob([1], latest)).toMatchObject({ status: 'cancelled' });
      [latest] = pass.enqueued;
      expect(await setAsideJobs(world)).toEqual([]);
    }
  });

  it('runs nothing on a schedule for a space refused one, and takes its schedules off the queue', async () => {
    const world = cluster([scheduled('30 0 * * *')]);
    await seed(world);
    let plan: string | undefined;
    const scheduler = createScheduler({
      queue: world.queue,
      lookups: world.lookups,
      admit: () => Promise.resolve(plan)
    });

    // Its plan no longer runs schedules: the fire due is not run, and the schedule is gone.
    plan = 'Scheduled runs are in App+ and up';
    world.at('2026-03-01T00:30:00Z');

    expect((await scheduler.sweep()).enqueued).toEqual([]);
    expect(await world.queue.listSchedules([1])).toEqual([]);

    // Back on a plan that runs them: the next reconcile puts them back.
    plan = undefined;
    await scheduler.reconcile(1);

    expect(await world.queue.listSchedules([1])).toHaveLength(1);
  });

  it('produces one job however many replicas reach the same fire', async () => {
    const world = cluster([scheduled('30 0 * * *')]);
    await seed(world);
    world.at('2026-03-01T00:30:00Z');

    // Deliberately concurrent, and deliberately against one store: this is the case a leader lock used to be for.
    const passes = await Promise.all([world.replica().sweep(), world.replica().sweep(), world.replica().sweep()]);
    const enqueued = passes.flatMap(pass => pass.enqueued);
    const duplicates = passes.flatMap(pass => pass.duplicates);

    expect(enqueued).toHaveLength(1);
    expect(duplicates).toHaveLength(2);
    expect((await world.queue.listJobs({ spaceIds: [1], limit: 10, offset: 0 })).total).toBe(1);
  });

  it('loses nothing when a replica dies between enqueuing a fire and recording it', async () => {
    const world = cluster([scheduled('30 0 * * *')]);
    await seed(world);
    world.at('2026-03-01T00:30:00Z');

    // The crash: the job is written, the schedule never moves.
    const dying: JobQueue = { ...world.queue, advanceSchedule: () => Promise.reject(new Error('pod killed')) };
    await expect(world.replica(dying).sweep()).rejects.toThrow('pod killed');

    const survivor = await world.replica().sweep();
    expect(survivor.enqueued).toEqual([]);
    expect(survivor.duplicates).toHaveLength(1);
    expect((await world.queue.listJobs({ spaceIds: [1], limit: 10, offset: 0 })).total).toBe(1);
    const [schedule] = await world.queue.listSchedules([1]);
    expect(new Date(schedule.nextRunAt).toISOString()).toBe('2026-03-02T00:30:00.000Z');
  });

  it('answers an outage with one catch-up run and a count of what went by', async () => {
    const world = cluster([scheduled('0 * * * *')]);
    await seed(world);

    // Nothing ran for five hours. The job produced is the OLDEST overdue fire — the only instant every replica
    // agrees on, because it is the one the row already held — and the five after it are counted, not run.
    world.at('2026-03-01T05:00:00Z');
    const caught = await world.replica().sweep();

    expect(caught.enqueued).toEqual([`schedule:1:digest:${MIDNIGHT}`]);
    expect(caught.missed).toEqual([{ spaceId: 1, actionId: 'digest', count: 5 }]);
    const [schedule] = await world.queue.listSchedules([1]);
    expect(schedule.missed).toBe(5);
    expect(new Date(schedule.nextRunAt).toISOString()).toBe('2026-03-01T06:00:00.000Z');
  });

  // A sweep never lands exactly on the minute — it runs every few seconds, so it is almost always a little late. A
  // late sweep must still owe the very next occurrence, or an every-minute schedule fires every OTHER minute.
  it('owes the next occurrence after a sweep that ran a few seconds late', async () => {
    const world = cluster([scheduled('* * * * *')]);
    world.at('2026-03-01T00:00:30Z');
    await seed(world);

    world.at('2026-03-01T00:01:07Z');
    expect((await world.replica().sweep()).enqueued).toEqual([
      `schedule:1:digest:${Date.parse('2026-03-01T00:01:00Z')}`
    ]);

    const [schedule] = await world.queue.listSchedules([1]);
    expect(new Date(schedule.nextRunAt).toISOString()).toBe('2026-03-01T00:02:00.000Z');
    expect(schedule.missed).toBe(0);

    world.at('2026-03-01T00:02:04Z');
    expect((await world.replica().sweep()).enqueued).toEqual([
      `schedule:1:digest:${Date.parse('2026-03-01T00:02:00Z')}`
    ]);
  });

  // The boundary itself: a sweep a whole minute late has let one occurrence go by, and owes the one after it.
  it('counts the occurrence a late sweep let go by, and owes the one after it', async () => {
    const world = cluster([scheduled('* * * * *')]);
    world.at('2026-03-01T00:00:30Z');
    await seed(world);

    world.at('2026-03-01T00:02:00.500Z');
    await world.replica().sweep();

    const [schedule] = await world.queue.listSchedules([1]);
    expect(schedule.missed).toBe(1);
    expect(new Date(schedule.nextRunAt).toISOString()).toBe('2026-03-01T00:03:00.000Z');
  });

  it('does not fire a schedule whose trigger is switched off, and keeps its row', async () => {
    const world = cluster([scheduled('30 0 * * *', false)]);
    await seed(world);
    world.at('2026-03-01T00:30:00Z');

    expect((await world.replica().sweep()).enqueued).toEqual([]);
    expect(await world.queue.listSchedules([1])).toMatchObject([{ actionId: 'digest', enabled: false }]);
  });

  it('drops the schedule of an action that no longer declares one', async () => {
    const world = cluster([scheduled('30 0 * * *')]);
    await seed(world);
    expect(await world.queue.listSchedules([1])).toHaveLength(1);

    world.lookups.listActions = () => Promise.resolve([]);
    await world.replica().reconcile(1);

    expect(await world.queue.listSchedules([1])).toEqual([]);
  });

  it('keeps a promised fire when a save does not change the expression', async () => {
    const world = cluster([scheduled('30 0 * * *')]);
    await seed(world);
    const [before] = await world.queue.listSchedules([1]);

    world.at('2026-03-01T00:15:00Z');
    await world.replica().reconcile(1);

    const [after] = await world.queue.listSchedules([1]);
    expect(after.nextRunAt).toBe(before.nextRunAt);
  });

  // A store that drops its connections for a moment fails one sweep, and the next works: nothing to raise an alarm
  // about. See `createFailureStreak`.
  it('reports a sweep that failed once as a warning, and sweeps again', async () => {
    // The sweep interval carries up to a second of jitter, so time is advanced rather than waited for.
    vi.useFakeTimers();
    const warn = vi.spyOn(serverLog, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(serverLog, 'error').mockImplementation(() => {});
    const memory = createMemoryJobQueue();
    const dueSchedules = vi
      .fn<JobQueue['dueSchedules']>()
      .mockRejectedValueOnce(new Error('interrupted due to server monitor timeout'))
      .mockImplementation(limit => memory.dueSchedules(limit));
    const scheduler = createScheduler({
      queue: { ...memory, dueSchedules },
      lookups: { getAction: () => Promise.resolve(undefined), listActions: () => Promise.resolve([]) },
      spaces: [1],
      pollMs: 5
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(2_100);
    scheduler.stop();

    expect(dueSchedules.mock.calls.length).toBeGreaterThan(1);
    expect(warn).toHaveBeenCalledWith(
      'Actions',
      'schedule sweep failed, trying again',
      'interrupted due to server monitor timeout'
    );
    expect(error).not.toHaveBeenCalled();
  });

  it('says so, once, when nothing tells it which spaces to watch', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const queue = createMemoryJobQueue();
    const scheduler = createScheduler({ queue, lookups: { getAction: () => Promise.resolve(undefined) } });

    scheduler.start();
    scheduler.stop();

    expect(warn.mock.calls[0][0]).toContain('which spaces to watch');
    warn.mockRestore();
  });
});

describe('schedulesFor', () => {
  it('reads the expression and the zone it was written in', () => {
    const entry = scheduled('0 9 * * *');
    entry.document.nodes.start.params.timezone = 'America/Santiago';

    const [schedule] = schedulesFor([entry], 1, 'main', new Date(MIDNIGHT));

    expect(schedule.timezone).toBe('America/Santiago');
    expect(new Date(schedule.nextRunAt).toISOString()).toBe('2026-03-01T12:00:00.000Z');
  });

  it('drops a zone nothing knows rather than firing at the wrong hour', () => {
    const entry = scheduled('0 9 * * *');
    entry.document.nodes.start.params.timezone = 'Mars/Olympus';

    const [schedule] = schedulesFor([entry], 1, 'main', new Date(MIDNIGHT));

    expect(schedule.timezone).toBeUndefined();
    expect(schedule.nextRunAt).toBe(Date.parse('2026-03-01T09:00:00Z'));
  });

  it('ignores an action with no schedule at all', () => {
    const entry = scheduled('0 9 * * *');
    entry.document.nodes.start.action = 'call';

    expect(schedulesFor([entry], 1, 'main', new Date(MIDNIGHT))).toEqual([]);
  });
});
