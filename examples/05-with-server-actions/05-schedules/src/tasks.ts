import { acceptsQueuedJobs } from './actions';
import { shapeBoard } from './board';

import type { ActivityLog } from './store/activity';
import type { ActionLookups, ActionTask } from '@plitzi/sdk-server/actions';
import type { ActionJobQueue, ActionJobStatus } from '@plitzi/sdk-shared';

/**
 * This deployment's own steps — the extension point `01-actions` introduces, used here for the work only a
 * deployment can do: reach its own queue and its own activity log.
 *
 * Built by a factory because they close over those two, which are this process's and nobody else's. A flow never
 * sees the queue; it names a step, and the step is the only thing that may touch it.
 */

type TaskDeps = {
  queue: ActionJobQueue;
  activity: ActivityLog;
  lookups: ActionLookups;
  /** Names this process in the activity feed, so a job that moved between replicas is visible as having moved. */
  replica: string;
};

/** Twig hands back a lone token with its own type and an embedded one as text, so a number arrives either way. */
const toNumber = (value: string | number, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : fallback;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `payload: '{{input}}'` arrives as the object itself; typed into the builder's text box it arrives as JSON. */
const toPayload = (value: unknown): Record<string, unknown> => {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return {};
  }

  const parsed: unknown = JSON.parse(value);

  return isRecord(parsed) ? parsed : {};
};

/** Waits, and stops waiting the moment the run is cancelled — the difference between a cancel that lands now and
 *  one that lands whenever the work would have finished anyway. */
const pause = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Stopped before it started'));

      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Stopped by an operator'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });

const STATUSES: ActionJobStatus[] = ['pending', 'running', 'succeeded', 'failed', 'dead', 'cancelled'];

export const createTasks = ({ queue, activity, lookups, replica }: TaskDeps) => {
  const note: ActionTask<{ message: string }> = {
    namespace: 'example',
    action: 'note',
    title: 'Note',
    description: 'Writes a line to the activity feed, naming the replica that ran it.',
    params: { message: { type: 'text', canBind: true, defaultValue: '', label: 'Message' } },
    run: ({ message }, ctx) => {
      activity.append({ replica, trigger: ctx.trigger, message });

      return { message };
    }
  };

  /**
   * Puts a job on the queue for later — the whole of "do this in five seconds".
   *
   * A job is a due time and an action. The worker that claims it runs the action through the same runner a page
   * call goes through, with every check that implies, so this step decides only WHAT and WHEN. It refuses an
   * action that does not declare the queue trigger: a public button must not be able to enqueue whatever action
   * id it is handed, and the runner would refuse the job anyway — later, as a dead job nobody asked for.
   *
   * The job id is derived from the run that asked, so the same run retried writes the same job rather than two.
   */
  const enqueue: ActionTask<{
    actionId: string;
    delaySeconds: string | number;
    payload: unknown;
    maxAttempts: string | number;
  }> = {
    namespace: 'example',
    action: 'enqueue',
    title: 'Queue a job',
    description: 'Queues a job for an action that declares the queue trigger, due after a delay.',
    params: {
      actionId: { type: 'text', canBind: true, defaultValue: '', label: 'Action' },
      delaySeconds: { type: 'text', canBind: true, defaultValue: '0', label: 'Delay (s)' },
      payload: { type: 'text', canBind: true, defaultValue: '{}', label: 'Input (JSON)' },
      maxAttempts: { type: 'text', canBind: true, defaultValue: '3', label: 'Attempts' }
    },
    run: async ({ actionId, delaySeconds, payload, maxAttempts }, ctx) => {
      const entry = await lookups.getAction(ctx.spaceId, actionId);
      if (!entry || !acceptsQueuedJobs(entry)) {
        throw new Error(`"${actionId}" cannot be queued: it declares no enabled "queue" trigger`);
      }

      const id = `later:${actionId}:${ctx.runId}`;
      const delayMs = Math.max(0, toNumber(delaySeconds, 0)) * 1000;
      // The queue's clock, like every instant the queue holds — never this process's.
      const dueAt = (await queue.now()).getTime() + delayMs;
      await queue.enqueue({
        id,
        spaceId: ctx.spaceId,
        actionId,
        environment: ctx.environment,
        trigger: 'custom',
        // The job's own id travels with it, for a flow that counts its attempts — see `flaky-sync`. An action that
        // does not declare `jobId` never sees it: undeclared input is dropped before its first step.
        input: { ...toPayload(payload), jobId: id },
        dueAt,
        maxAttempts: Math.max(1, Math.round(toNumber(maxAttempts, 3)))
      });

      const when = delayMs > 0 ? `due in ${delayMs / 1000}s` : 'due now';

      return { jobId: id, dueAt, summary: `Queued “${entry.document.name}” — ${when}. Watch it on the board.` };
    }
  };

  /**
   * Refused by its "upstream" the first `failures` times. The count lives in `kv`, keyed by the job, because it has
   * to outlast every attempt — and in the SHARED kv, because the next attempt may run on another replica.
   */
  const flaky: ActionTask<{ jobId: string; failures: string | number }> = {
    namespace: 'example',
    action: 'flaky',
    title: 'Flaky upstream',
    description: 'Fails a set number of attempts, then succeeds.',
    params: {
      jobId: { type: 'text', canBind: true, defaultValue: '', label: 'Job id' },
      failures: { type: 'text', canBind: true, defaultValue: '2', label: 'Attempts to refuse' }
    },
    run: async ({ jobId, failures }, ctx) => {
      const attempt = await ctx.kv.increment(`flaky:${jobId}`, 1, 3600);
      if (attempt <= toNumber(failures, 2)) {
        activity.append({
          replica,
          trigger: ctx.trigger,
          message: `Flaky sync: the upstream refused attempt ${attempt}`
        });
        throw new Error(`The upstream refused attempt ${attempt}`);
      }

      activity.append({ replica, trigger: ctx.trigger, message: `Flaky sync went through on attempt ${attempt}` });

      return { attempt };
    }
  };

  const work: ActionTask<{ seconds: string | number }> = {
    namespace: 'example',
    action: 'work',
    title: 'Slow work',
    description: 'Works for a number of seconds, one second at a time, stopping when the run is cancelled.',
    params: { seconds: { type: 'text', canBind: true, defaultValue: '20', label: 'Seconds' } },
    run: async ({ seconds }, ctx) => {
      const total = Math.max(1, Math.round(toNumber(seconds, 20)));
      activity.append({ replica, trigger: ctx.trigger, message: `Slow export started: ${total}s of work` });
      try {
        for (let done = 0; done < total; done += 1) {
          await pause(1000, ctx.signal);
        }
      } catch (error) {
        activity.append({ replica, trigger: ctx.trigger, message: 'Slow export stopped part-way' });
        throw error;
      }

      activity.append({ replica, trigger: ctx.trigger, message: `Slow export finished after ${total}s` });

      return { seconds: total };
    }
  };

  /** One read of everything the page shows. Counted per status by the store, not from the page of jobs it lists. */
  const board: ActionTask<Record<string, never>> = {
    namespace: 'example',
    action: 'board',
    title: 'Queue board',
    description: 'Schedules, recent jobs and recent activity, formatted for the page.',
    params: {},
    run: async (_params, ctx) => {
      const spaceIds = [ctx.spaceId];
      const [at, { jobs }, waiting, done, schedules, actions, totals] = await Promise.all([
        queue.now(),
        queue.listJobs({ spaceIds, limit: 12, offset: 0 }),
        queue.listJobs({ spaceIds, actionId: 'reminder', status: 'pending', limit: 20, offset: 0 }),
        queue.listJobs({ spaceIds, actionId: 'reminder', status: 'succeeded', limit: 1, offset: 0 }),
        queue.listSchedules(spaceIds),
        lookups.listActions?.(ctx.spaceId) ?? Promise.resolve([]),
        Promise.all(STATUSES.map(status => queue.listJobs({ spaceIds, status, limit: 0, offset: 0 })))
      ]);
      const counts: Record<ActionJobStatus, number> = {
        pending: 0,
        running: 0,
        succeeded: 0,
        failed: 0,
        dead: 0,
        cancelled: 0
      };
      STATUSES.forEach((status, index) => {
        counts[status] = totals[index]?.total ?? 0;
      });

      return shapeBoard({
        at: at.getTime(),
        replica,
        actions,
        jobs,
        schedules,
        activity: activity.recent(10),
        counts,
        reminders: { waiting: waiting.jobs, ...(done.jobs[0] ? { last: done.jobs[0] } : {}) }
      });
    }
  };

  /** Both refuse a job of another space: the queue is asked with this run's space id, never with one it was sent. */
  const retry: ActionTask<{ jobId: string }> = {
    namespace: 'example',
    action: 'retry',
    title: 'Run a job again',
    description: 'Puts a finished job back in the queue, due now, with its attempts reset and its history kept.',
    params: { jobId: { type: 'text', canBind: true, defaultValue: '', label: 'Job id' } },
    run: async ({ jobId }, ctx) => {
      const ok = await queue.requeue([ctx.spaceId], jobId);

      return { ok, summary: ok ? 'Back in the queue — due now.' : 'That job is not finished, or no longer exists.' };
    }
  };

  const cancel: ActionTask<{ jobId: string }> = {
    namespace: 'example',
    action: 'cancel',
    title: 'Cancel a job',
    description: 'Drops a waiting job; asks the worker holding a running one to stop it at its next heartbeat.',
    params: { jobId: { type: 'text', canBind: true, defaultValue: '', label: 'Job id' } },
    run: async ({ jobId }, ctx) => {
      const ok = await queue.cancel([ctx.spaceId], jobId);

      return {
        ok,
        summary: ok ? 'Cancelled — a running job stops within a few seconds.' : 'That job has already finished.'
      };
    }
  };

  return [note, enqueue, flaky, work, board, retry, cancel];
};
