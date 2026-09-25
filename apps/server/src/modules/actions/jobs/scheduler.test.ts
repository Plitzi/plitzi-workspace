import { describe, expect, it, vi } from 'vitest';

import { createMemoryJobQueue } from './memoryQueue';
import { createScheduler } from './scheduler';
import { schedulesFor } from './schedules';
import { serverLog } from '../../../helpers/serverLog';

import type { ActionEntry, ActionJobQueue, ElementInteraction } from '@plitzi/sdk-shared';

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
    replica: (over: ActionJobQueue = queue) => createScheduler({ queue: over, lookups })
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
    const dying: ActionJobQueue = { ...world.queue, advanceSchedule: () => Promise.reject(new Error('pod killed')) };
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
    const warn = vi.spyOn(serverLog, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(serverLog, 'error').mockImplementation(() => {});
    const memory = createMemoryJobQueue();
    const dueSchedules = vi
      .fn<ActionJobQueue['dueSchedules']>()
      .mockRejectedValueOnce(new Error('interrupted due to server monitor timeout'))
      .mockImplementation(limit => memory.dueSchedules(limit));
    const scheduler = createScheduler({
      queue: { ...memory, dueSchedules },
      lookups: { getAction: () => Promise.resolve(undefined), listActions: () => Promise.resolve([]) },
      spaces: [1],
      pollMs: 5
    });

    scheduler.start();
    await vi.waitFor(() => expect(dueSchedules.mock.calls.length).toBeGreaterThan(1));
    scheduler.stop();

    expect(warn).toHaveBeenCalledWith(
      'Actions',
      'schedule sweep failed, trying again',
      'interrupted due to server monitor timeout'
    );
    expect(error).not.toHaveBeenCalled();
    vi.restoreAllMocks();
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
