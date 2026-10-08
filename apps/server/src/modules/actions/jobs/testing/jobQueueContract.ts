import { beforeEach, describe, expect, it } from 'vitest';

import type { ActionKvAdapter } from '../../types';
import type { ActionJobInput, ActionJobQueue, ActionScheduleInput } from '@plitzi/sdk-shared';

/**
 * What every {@link ActionJobQueue} must do, written once and run against each one this package ships.
 *
 * The memory queue, the Mongo helper and the MySQL helper are three implementations of one contract, and the contract
 * is where a scheduling bug lives: a claim that is not atomic runs a job twice, a heartbeat that does not renew hands a
 * running job to another replica, a settlement from a worker that lost its lease overwrites a live attempt. Asserting
 * those once per store is what makes "swap the store" a one-line change rather than a new set of bugs.
 *
 * Real time, real stores: leases are tens of milliseconds and the tests wait them out, because the store's own clock
 * is part of what is being tested.
 */

export type QueueSubject = {
  queue: ActionJobQueue;
  /** Empties whatever the queue keeps, between tests. */
  clear: () => Promise<void>;
};

const SPACE = 7_001;
const OTHER_SPACE = 7_002;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const describeJobQueue = (name: string, open: () => Promise<QueueSubject>, enabled = true): void => {
  describe.skipIf(!enabled)(`${name} — the job queue contract`, () => {
    let queue: ActionJobQueue;
    let clear: () => Promise<void>;

    const nowMs = async () => (await queue.now()).getTime();

    const job = async (over: Partial<ActionJobInput> = {}): Promise<ActionJobInput> => ({
      id: 'job-1',
      spaceId: SPACE,
      actionId: 'digest',
      environment: 'main',
      trigger: 'schedule',
      input: { to: 'ops@example.test' },
      dueAt: (await nowMs()) - 1_000,
      maxAttempts: 3,
      ...over
    });

    const schedule = async (over: Partial<ActionScheduleInput> = {}): Promise<ActionScheduleInput> => ({
      spaceId: SPACE,
      actionId: 'digest',
      cron: '*/5 * * * *',
      environment: 'main',
      enabled: true,
      nextRunAt: (await nowMs()) - 60_000,
      maxAttempts: 3,
      ...over
    });

    beforeEach(async () => {
      ({ queue, clear } = await open());
      await clear();
    });

    it('reads a clock that is the real time', async () => {
      expect(Math.abs((await nowMs()) - Date.now())).toBeLessThan(5_000);
    });

    it('creates a job once, however many producers race for its id', async () => {
      const input = await job();
      const results = await Promise.all(Array.from({ length: 10 }, () => queue.enqueue(input)));

      expect(results.filter(Boolean)).toHaveLength(1);
      expect(await queue.getJob([SPACE], input.id)).toMatchObject({
        status: 'pending',
        attempts: 0,
        runAt: input.dueAt,
        input: { to: 'ops@example.test' },
        history: []
      });
    });

    it('claims only what is due', async () => {
      await queue.enqueue(await job({ id: 'later', dueAt: (await nowMs()) + 60_000 }));

      expect(await queue.claim({ workerId: 'pod-a', leaseMs: 60_000, limit: 5 })).toEqual([]);
    });

    it('gives each job to one worker, however many claim at once', async () => {
      for (let index = 0; index < 5; index += 1) {
        await queue.enqueue(await job({ id: `race-${index}` }));
      }

      const claims = await Promise.all(
        ['pod-a', 'pod-b', 'pod-c'].map(workerId => queue.claim({ workerId, leaseMs: 60_000, limit: 5 }))
      );
      const taken = claims.flat().map(claimed => claimed.id);

      expect(taken).toHaveLength(5);
      expect(new Set(taken).size).toBe(5);
    });

    it('drains a backlog across workers claiming together, each job exactly once', async () => {
      for (let index = 0; index < 30; index += 1) {
        await queue.enqueue(await job({ id: `backlog-${index}` }));
      }

      const drain = async (workerId: string): Promise<string[]> => {
        const mine: string[] = [];
        for (let round = 0; round < 20; round += 1) {
          const claimed = await queue.claim({ workerId, leaseMs: 60_000, limit: 5 });
          if (claimed.length === 0) {
            break;
          }

          mine.push(...claimed.map(entry => entry.id));
        }

        return mine;
      };

      const taken = (await Promise.all(['pod-a', 'pod-b', 'pod-c', 'pod-d'].map(drain))).flat();

      expect(taken).toHaveLength(30);
      expect(new Set(taken).size).toBe(30);
    });

    it('marks a claimed job as running, under a lease', async () => {
      await queue.enqueue(await job());
      const before = await nowMs();
      const [claimed] = await queue.claim({ workerId: 'pod-a', leaseMs: 60_000, limit: 1 });

      expect(claimed).toMatchObject({ status: 'running', attempts: 1, workerId: 'pod-a' });
      expect(claimed.leaseUntil).toBeGreaterThanOrEqual(before + 59_000);
    });

    it('hands a job whose lease lapsed to the next worker, and writes the lost attempt', async () => {
      await queue.enqueue(await job());
      await queue.claim({ workerId: 'pod-a', leaseMs: 40, limit: 1 });
      await wait(150);

      const [taken] = await queue.claim({ workerId: 'pod-b', leaseMs: 60_000, limit: 1 });

      expect(taken).toMatchObject({ workerId: 'pod-b', attempts: 2 });
      expect(taken.history).toMatchObject([{ attempt: 1, status: 'lost', workerId: 'pod-a' }]);
    });

    it('keeps a claim alive while its worker reports in', async () => {
      // Only the wait past the first lease is timed; a slow store can make the heartbeat or the next claim late, never
      // early, so each has the room a busy CI runner needs.
      await queue.enqueue(await job());
      await queue.claim({ workerId: 'pod-a', leaseMs: 1_000, limit: 1 });
      await wait(150);
      expect(await queue.heartbeat({ jobIds: ['job-1'], workerId: 'pod-a', leaseMs: 60_000 })).toEqual([]);
      await wait(1_000);

      // Past the lease it was claimed with, inside the one it was renewed to.
      expect(await queue.claim({ workerId: 'pod-b', leaseMs: 60_000, limit: 1 })).toEqual([]);
    });

    it('renews nothing for a worker that does not hold the job', async () => {
      await queue.enqueue(await job());
      await queue.claim({ workerId: 'pod-a', leaseMs: 40, limit: 1 });
      await queue.heartbeat({ jobIds: ['job-1'], workerId: 'pod-b', leaseMs: 60_000 });
      await wait(150);

      expect(await queue.claim({ workerId: 'pod-c', leaseMs: 60_000, limit: 1 })).toHaveLength(1);
    });

    it('records a finished attempt', async () => {
      await queue.enqueue(await job());
      await queue.claim({ workerId: 'pod-a', leaseMs: 60_000, limit: 1 });
      await queue.settle({
        jobId: 'job-1',
        workerId: 'pod-a',
        status: 'succeeded',
        runId: 'run-1',
        attempt: { status: 'succeeded', workerId: 'pod-a', runId: 'run-1' }
      });

      const done = await queue.getJob([SPACE], 'job-1');
      expect(done).toMatchObject({ status: 'succeeded', runId: 'run-1', attempts: 1 });
      expect(done?.leaseUntil).toBeUndefined();
      expect(done?.history).toMatchObject([{ attempt: 1, status: 'succeeded', workerId: 'pod-a', runId: 'run-1' }]);
      expect(done?.history[0].endedAt).toBeGreaterThanOrEqual(done?.history[0].startedAt ?? Infinity);
    });

    it('ignores a settlement from a worker that no longer holds the job', async () => {
      await queue.enqueue(await job());
      await queue.claim({ workerId: 'pod-a', leaseMs: 40, limit: 1 });
      await wait(150);
      await queue.claim({ workerId: 'pod-b', leaseMs: 60_000, limit: 1 });

      await queue.settle({
        jobId: 'job-1',
        workerId: 'pod-a',
        status: 'succeeded',
        attempt: { status: 'succeeded', workerId: 'pod-a' }
      });

      expect(await queue.getJob([SPACE], 'job-1')).toMatchObject({ status: 'running', workerId: 'pod-b' });
    });

    it('holds a retry until its backoff is up, keeping the failed attempt', async () => {
      await queue.enqueue(await job());
      await queue.claim({ workerId: 'pod-a', leaseMs: 60_000, limit: 1 });
      await queue.settle({
        jobId: 'job-1',
        workerId: 'pod-a',
        status: 'pending',
        delayMs: 60_000,
        error: 'the provider said no',
        attempt: { status: 'failed', workerId: 'pod-a', error: 'the provider said no' }
      });

      expect(await queue.claim({ workerId: 'pod-b', leaseMs: 60_000, limit: 1 })).toEqual([]);
      expect(await queue.getJob([SPACE], 'job-1')).toMatchObject({
        status: 'pending',
        attempts: 1,
        error: 'the provider said no',
        history: [{ attempt: 1, status: 'failed', error: 'the provider said no' }]
      });
    });

    it('gives the attempt back when a worker hands the job over untouched', async () => {
      await queue.enqueue(await job());
      await queue.claim({ workerId: 'pod-a', leaseMs: 60_000, limit: 1 });
      await queue.settle({ jobId: 'job-1', workerId: 'pod-a', status: 'pending', delayMs: 0 });

      const back = await queue.getJob([SPACE], 'job-1');
      expect(back).toMatchObject({ status: 'pending', attempts: 0, history: [] });
      expect(back?.workerId).toBeUndefined();
      expect(await queue.claim({ workerId: 'pod-b', leaseMs: 60_000, limit: 1 })).toHaveLength(1);
    });

    it('lists jobs by space, action and status, newest first, and counts them all', async () => {
      await queue.enqueue(await job({ id: 'a' }));
      await wait(5);
      await queue.enqueue(await job({ id: 'b', actionId: 'report' }));
      await wait(5);
      await queue.enqueue(await job({ id: 'c' }));
      await queue.enqueue(await job({ id: 'elsewhere', spaceId: OTHER_SPACE }));

      const all = await queue.listJobs({ spaceIds: [SPACE], limit: 2, offset: 0 });
      expect(all.total).toBe(3);
      expect(all.jobs.map(entry => entry.id)).toEqual(['c', 'b']);

      const reports = await queue.listJobs({ spaceIds: [SPACE], actionId: 'report', limit: 10, offset: 0 });
      expect(reports.jobs.map(entry => entry.id)).toEqual(['b']);

      const running = await queue.listJobs({ spaceIds: [SPACE], status: 'running', limit: 10, offset: 0 });
      expect(running.total).toBe(0);

      // Another space's job is not there to be read, by id either.
      expect(await queue.getJob([SPACE], 'elsewhere')).toBeUndefined();
    });

    it('turns a due schedule into one advance, however many replicas try', async () => {
      await queue.putSchedules({ spaceId: SPACE, schedules: [await schedule()] });
      const [due] = await queue.dueSchedules(10);
      expect(due).toMatchObject({ actionId: 'digest', missed: 0, enabled: true });

      const moved = await Promise.all(
        Array.from({ length: 5 }, () =>
          queue.advanceSchedule({
            spaceId: SPACE,
            actionId: 'digest',
            from: due.nextRunAt,
            to: due.nextRunAt + 300_000,
            missed: 2
          })
        )
      );

      expect(moved.filter(Boolean)).toHaveLength(1);
      const [after] = await queue.listSchedules([SPACE]);
      expect(after).toMatchObject({ nextRunAt: due.nextRunAt + 300_000, lastFireAt: due.nextRunAt, missed: 2 });
    });

    // Every replica reconciles the spaces it schedules at boot, and a rolling deploy boots them together.
    it('takes one space’s schedules written by several replicas at once', async () => {
      const incoming = [await schedule(), await schedule({ actionId: 'report' })];
      await Promise.all(Array.from({ length: 5 }, () => queue.putSchedules({ spaceId: SPACE, schedules: incoming })));

      expect((await queue.listSchedules([SPACE])).map(entry => entry.actionId).sort()).toEqual(['digest', 'report']);
    });

    it('offers only enabled schedules that are due, oldest fire first', async () => {
      const at = await nowMs();
      await queue.putSchedules({
        spaceId: SPACE,
        schedules: [
          await schedule({ actionId: 'newer', nextRunAt: at - 1_000 }),
          await schedule({ actionId: 'older', nextRunAt: at - 5_000 }),
          await schedule({ actionId: 'off', enabled: false }),
          await schedule({ actionId: 'future', nextRunAt: at + 60_000 })
        ]
      });

      expect((await queue.dueSchedules(10)).map(entry => entry.actionId)).toEqual(['older', 'newer']);
    });

    it('keeps a fire already promised when a save does not change the expression', async () => {
      await queue.putSchedules({ spaceId: SPACE, schedules: [await schedule({ nextRunAt: 1_000 })] });
      await queue.putSchedules({ spaceId: SPACE, schedules: [await schedule({ nextRunAt: 2_000 })] });
      expect((await queue.listSchedules([SPACE]))[0].nextRunAt).toBe(1_000);

      await queue.putSchedules({
        spaceId: SPACE,
        schedules: [await schedule({ cron: '0 * * * *', nextRunAt: 3_000 })]
      });
      expect((await queue.listSchedules([SPACE]))[0]).toMatchObject({ cron: '0 * * * *', nextRunAt: 3_000 });
    });

    it('drops the schedule of an action that stopped declaring one, and nobody else’s', async () => {
      await queue.putSchedules({
        spaceId: SPACE,
        schedules: [await schedule(), await schedule({ actionId: 'report' })]
      });
      await queue.putSchedules({ spaceId: OTHER_SPACE, schedules: [await schedule({ spaceId: OTHER_SPACE })] });

      await queue.putSchedules({ spaceId: SPACE, schedules: [await schedule()] });

      expect((await queue.listSchedules([SPACE])).map(entry => entry.actionId)).toEqual(['digest']);
      expect(await queue.listSchedules([OTHER_SPACE])).toHaveLength(1);
    });

    it('runs a finished job again when an operator asks, keeping its history', async () => {
      await queue.enqueue(await job());
      await queue.claim({ workerId: 'pod-a', leaseMs: 60_000, limit: 1 });
      expect(await queue.requeue([SPACE], 'job-1')).toBe(false);

      await queue.settle({
        jobId: 'job-1',
        workerId: 'pod-a',
        status: 'succeeded',
        attempt: { status: 'succeeded', workerId: 'pod-a' }
      });

      expect(await queue.requeue([OTHER_SPACE], 'job-1')).toBe(false);
      expect(await queue.requeue([SPACE], 'job-1')).toBe(true);
      expect(await queue.getJob([SPACE], 'job-1')).toMatchObject({
        status: 'pending',
        attempts: 0,
        history: [{ attempt: 1 }]
      });
      expect(await queue.claim({ workerId: 'pod-b', leaseMs: 60_000, limit: 1 })).toHaveLength(1);
    });

    it('drops a waiting job, and flags a running one for the worker holding it', async () => {
      await queue.enqueue(await job({ id: 'waiting' }));
      expect(await queue.cancel([SPACE], 'waiting')).toBe(true);
      expect(await queue.getJob([SPACE], 'waiting')).toMatchObject({ status: 'cancelled' });
      expect(await queue.cancel([SPACE], 'waiting')).toBe(false);

      await queue.enqueue(await job({ id: 'running' }));
      await queue.claim({ workerId: 'pod-a', leaseMs: 60_000, limit: 1 });
      expect(await queue.cancel([SPACE], 'running')).toBe(true);
      expect(await queue.getJob([SPACE], 'running')).toMatchObject({ status: 'running', cancelRequested: true });
      expect(await queue.heartbeat({ jobIds: ['running'], workerId: 'pod-a', leaseMs: 60_000 })).toEqual(['running']);
    });

    /** A turn's timer set again: the one still waiting goes, the newest stays — on every replica, whoever came first. */
    it('drops what waits under a key — all of it, or what came before one job — and leaves what runs', async () => {
      const later = async (id: string, key: string) =>
        queue.enqueue(await job({ id, key, trigger: 'later', dueAt: (await nowMs()) + 60_000 }));
      await queue.enqueue(await job({ id: 'turn-running', key: 'turn:A', trigger: 'later' }));
      await queue.claim({ workerId: 'pod-a', leaseMs: 60_000, limit: 1 });
      await later('turn-1', 'turn:A');
      await wait(5);
      await later('turn-2', 'turn:A');
      await later('other', 'turn:B');

      expect(await queue.cancelPending({ spaceId: SPACE, key: 'turn:A', olderThan: 'turn-2' })).toBe(1);
      expect(await queue.getJob([SPACE], 'turn-1')).toMatchObject({ status: 'cancelled', key: 'turn:A' });
      expect(await queue.getJob([SPACE], 'turn-2')).toMatchObject({ status: 'pending', key: 'turn:A' });
      expect(await queue.getJob([SPACE], 'turn-running')).toMatchObject({ status: 'running' });

      expect(await queue.cancelPending({ spaceId: OTHER_SPACE, key: 'turn:B' })).toBe(0);
      expect(await queue.cancelPending({ spaceId: SPACE, key: 'turn:B' })).toBe(1);
      expect(await queue.getJob([SPACE], 'other')).toMatchObject({ status: 'cancelled' });
    });
  });
};

export type KvSubject = {
  kv: ActionKvAdapter;
  clear: () => Promise<void>;
};

/** What every {@link ActionKvAdapter} must do: strings, a TTL the store enforces, and an increment nobody can race. */
export const describeKv = (name: string, open: () => Promise<KvSubject>, enabled = true): void => {
  describe.skipIf(!enabled)(`${name} — the key/value contract`, () => {
    let kv: ActionKvAdapter;

    beforeEach(async () => {
      const subject = await open();
      kv = subject.kv;
      await subject.clear();
    });

    it('stores a string, replaces it, and forgets it', async () => {
      expect(await kv.get('greeting')).toBeUndefined();
      await kv.set('greeting', 'hello');
      await kv.set('greeting', 'hi');
      expect(await kv.get('greeting')).toBe('hi');

      await kv.delete('greeting');
      expect(await kv.get('greeting')).toBeUndefined();
    });

    it('keeps keys apart that differ only in case or a trailing space', async () => {
      await kv.set('Board', 'upper');
      await kv.set('board', 'lower');
      await kv.set('board ', 'spaced');

      expect([await kv.get('Board'), await kv.get('board'), await kv.get('board ')]).toEqual([
        'upper',
        'lower',
        'spaced'
      ]);
    });

    it('keeps a value past 64 KB whole', async () => {
      const large = 'ñ'.repeat(70_000);
      await kv.set('large', large);

      expect(await kv.get('large')).toBe(large);
    });

    it('answers nothing for a key past its lifetime', async () => {
      await kv.set('short', 'lived', 1);
      expect(await kv.get('short')).toBe('lived');
      await wait(1_200);

      expect(await kv.get('short')).toBeUndefined();
    });

    it('counts from zero, and loses no increment to a race', async () => {
      expect(await kv.increment('hits', 2)).toBe(2);
      await Promise.all(Array.from({ length: 20 }, () => kv.increment('hits', 1)));

      expect(await kv.get('hits')).toBe('22');
    });

    it('keeps a counter’s lifetime when it is incremented, and starts again once it has lapsed', async () => {
      await kv.increment('window', 1);
      await kv.expire('window', 1);
      expect(await kv.increment('window', 1)).toBe(2);
      await wait(1_200);

      expect(await kv.get('window')).toBeUndefined();
      expect(await kv.increment('window', 1)).toBe(1);
    });

    it('gives no lifetime to a key that is not there', async () => {
      await kv.expire('nothing', 60);

      expect(await kv.get('nothing')).toBeUndefined();
    });

    it('writes only over the value it expected', async () => {
      await kv.set('seat', 'free');

      expect(await kv.swap('seat', 'taken', 'ana')).toBe(false);
      expect(await kv.swap('seat', 'free', 'ana')).toBe(true);
      expect(await kv.get('seat')).toBe('ana');
      expect(await kv.swap('seat', 'free', 'luis')).toBe(false);
      expect(await kv.get('seat')).toBe('ana');
    });

    it('compares the exact value — case and trailing spaces included', async () => {
      await kv.set('word', 'Ana');

      expect(await kv.swap('word', 'ana', 'x')).toBe(false);
      expect(await kv.swap('word', 'Ana ', 'x')).toBe(false);
      expect(await kv.get('word')).toBe('Ana');
    });

    it('writes back the value a key already holds, and says it did', async () => {
      await kv.set('same', 'v');

      expect(await kv.swap('same', 'v', 'v')).toBe(true);
    });

    it('expecting nothing, writes only where there is nothing — a lapsed key counts as nothing', async () => {
      expect(await kv.swap('claim', undefined, 'first')).toBe(true);
      expect(await kv.swap('claim', undefined, 'second')).toBe(false);
      expect(await kv.get('claim')).toBe('first');

      await kv.set('lapsing', 'old', 1);
      await wait(1_200);

      expect(await kv.swap('lapsing', undefined, 'new')).toBe(true);
      expect(await kv.get('lapsing')).toBe('new');
    });

    it('does not match a lapsed value it expected', async () => {
      await kv.set('gone', 'v', 1);
      await wait(1_200);

      expect(await kv.swap('gone', 'v', 'w')).toBe(false);
    });

    it('gives the written value the lifetime it was asked for', async () => {
      expect(await kv.swap('brief', undefined, 'v', 1)).toBe(true);
      await wait(1_200);

      expect(await kv.get('brief')).toBeUndefined();
    });

    it('lets exactly one of many racing writers win', async () => {
      await kv.set('last', '0');
      const answers = await Promise.all(Array.from({ length: 12 }, (_, i) => kv.swap('last', '0', String(i + 1))));
      const claims = await Promise.all(Array.from({ length: 12 }, (_, i) => kv.swap('fresh', undefined, String(i))));

      expect(answers.filter(Boolean)).toHaveLength(1);
      expect(claims.filter(Boolean)).toHaveLength(1);
    });
  });
};
