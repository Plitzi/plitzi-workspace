import { describe, expect, it } from 'vitest';

import { laterFor, MAX_LATER_SECONDS } from './later';
import { createMemoryJobQueue } from './memoryQueue';
import { createJobWorker } from './worker';
import { tasksOf } from '../../functions/testing/tasksOf';
import { createActionsModule } from '../index';

import type { FunctionTask } from '../../functions/contract';
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

const action = (id: string, trigger: string, enabled = true): ActionEntry => ({
  id,
  document: {
    name: id,
    nodes: {
      start: node('start', { type: 'trigger', action: trigger, params: {}, afterNode: 'work', enabled }),
      work: node('work', { action: 'test.work', afterNode: '' })
    }
  }
});

const NOON = Date.parse('2026-10-08T12:00:00Z');

const world = (entries: ActionEntry[] = [action('timeout', 'later')]) => {
  let now = NOON;
  const queue = createMemoryJobQueue({ clock: () => now });
  const lookups = {
    getAction: (_spaceId: number, actionId: string) => Promise.resolve(entries.find(entry => entry.id === actionId)),
    listActions: () => Promise.resolve(entries)
  };
  const { later, cancelLater } = laterFor(
    { queue: () => queue, lookups, maxAttempts: 3 },
    { spaceId: 1, environment: 'main' }
  );

  return {
    queue,
    lookups,
    later,
    cancelLater,
    advance: (ms: number) => {
      now += ms;
    },
    waiting: async () =>
      (await queue.listJobs({ spaceIds: [1], status: 'pending', limit: 50, offset: 0 })).jobs.map(job => job.input)
  };
};

describe('later', () => {
  it('queues the action for its trigger, due by the queue’s own clock', async () => {
    const { later, queue } = world();
    const { id, at } = await later({ action: 'timeout', in: 45, input: { room: 'ABCD' } });

    expect(at).toBe(NOON + 45_000);
    expect(await queue.getJob([1], id)).toMatchObject({
      actionId: 'timeout',
      trigger: 'later',
      input: { room: 'ABCD' },
      dueAt: NOON + 45_000,
      runAt: NOON + 45_000,
      status: 'pending'
    });
  });

  /** A move ends the turn: its timer is set again, and the old one must not fire on top of the new. */
  it('replaces what waits under the same key, and cancels it by name', async () => {
    const { later, cancelLater, waiting, advance } = world();
    await later({ action: 'timeout', in: 45, input: { turn: 1 }, key: 'turn:ABCD' });
    advance(1);
    await later({ action: 'timeout', in: 45, input: { turn: 2 }, key: 'turn:ABCD' });
    await later({ action: 'timeout', in: 90, input: { other: true }, key: 'turn:WXYZ' });

    expect(await waiting()).toEqual(expect.arrayContaining([{ turn: 2 }, { other: true }]));
    expect(await waiting()).toHaveLength(2);

    expect(await cancelLater('turn:ABCD')).toBe(1);
    expect(await waiting()).toEqual([{ other: true }]);
  });

  it('says why it queues nothing — an action with no later trigger, one switched off, a time out of range', async () => {
    const { later, waiting } = world([
      action('timeout', 'later'),
      action('page', 'call'),
      action('off', 'later', false)
    ]);

    await expect(later({ action: 'page', in: 5 })).rejects.toThrow(/give it a "later" trigger/);
    await expect(later({ action: 'off', in: 5 })).rejects.toThrow(/switched off/);
    await expect(later({ action: 'nope', in: 5 })).rejects.toThrow(/not one of this space's/);
    await expect(later({ action: 'timeout', in: MAX_LATER_SECONDS + 1 })).rejects.toThrow(/from 0 to/);
    await expect(later({ action: 'timeout', in: -1 })).rejects.toThrow(/from 0 to/);
    await expect(later({ action: 'timeout', in: 5, key: 'a key' })).rejects.toThrow(/letters, digits/);
    expect(await waiting()).toEqual([]);
  });

  it('is refused on a server that runs no jobs', async () => {
    const { lookups } = world();
    const { later } = laterFor(
      { queue: () => undefined, lookups, maxAttempts: 3 },
      { spaceId: 1, environment: 'main' }
    );

    await expect(later({ action: 'timeout', in: 5 })).rejects.toThrow(/runs no jobs/);
  });

  it('runs the action once due, through its later trigger and with its input', async () => {
    const { later, queue, lookups, advance } = world();
    const ran: unknown[] = [];
    const task: FunctionTask = {
      namespace: 'test',
      action: 'work',
      title: 'Work',
      params: {},
      run: (_params, ctx) => {
        ran.push(ctx.trigger);
      }
    };
    const module = createActionsModule({ lookups, functions: tasksOf(task), jobs: false });
    const worker = createJobWorker({ queue, lookups, module, pollMs: 5, leaseMs: 1_000, onError: () => {} });
    const { id } = await later({ action: 'timeout', in: 1, input: { room: 'ABCD' } });

    worker.start();
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(ran).toEqual([]);

    advance(1_000);
    await expect.poll(async () => (await queue.getJob([1], id))?.status).toBe('succeeded');
    await worker.stop();
    expect(ran).toEqual(['later']);
  });
});
