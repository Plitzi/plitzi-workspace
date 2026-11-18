import { serverLog } from '@plitzi/sdk-kernel/log';

import { jobViewOf } from './jobs';
import { createRealtimeHub } from '../realtime/hub';
import { publishJobView } from '../realtime/jobs';
import { createRealtimeRetained } from '../realtime/retained';

import type { ActionKvAdapter } from '../engine/types';
import type { JobQueue } from '../types';
import type { PubSubAdapter } from '@plitzi/sdk-shared';

export type JobControlOptions = {
  queue: JobQueue;
  /**
   * The page server's realtime — the pub/sub its replicas listen on and the `kv` its retained messages are kept in — so
   * whoever watches a job hears what an operator did to it. Absent, the queue changes and nobody is told until the job
   * moves again.
   */
  realtime?: { pubsub: PubSubAdapter; kv: ActionKvAdapter };
};

/** How many of the jobs dropped at once (`cancelWaiting`) have their watchers told at a time. */
const ANNOUNCED_AT_ONCE = 20;

export type JobControl = Pick<JobQueue, 'pause' | 'resume' | 'cancel' | 'requeue' | 'cancelWaiting'>;

/**
 * An operator's hold on the jobs, from a process that serves no pages — a deployment's API behind its Queue panel: the
 * queue's own `pause`, `resume`, `cancel`, `requeue` and `cancelWaiting`, each said on `$job:<id>` when it changed a job
 * of the spaces' functions, as the page server says it when its code does the same.
 */
export const createJobControl = ({ queue, realtime }: JobControlOptions): JobControl => {
  const said = realtime ? { retained: createRealtimeRetained(realtime.kv), pubsub: realtime.pubsub } : undefined;
  const hub = said ? createRealtimeHub(said.pubsub, said.retained) : undefined;

  const announce = async (spaceIds: number[], jobId: string): Promise<void> => {
    if (!hub || !said) {
      return;
    }

    try {
      const job = await queue.getJob(spaceIds, jobId);
      if (job?.target.kind === 'function') {
        await publishJobView(
          hub,
          said.retained,
          { spaceId: job.spaceId, environment: job.environment },
          jobId,
          jobViewOf(job)
        );
      }
    } catch (error) {
      serverLog.warn('Actions', `job ${jobId}: its watchers were not told what an operator did`, error);
    }
  };

  const told =
    <A extends unknown[]>(change: (spaceIds: number[], jobId: string, ...rest: A) => Promise<boolean>) =>
    async (spaceIds: number[], jobId: string, ...rest: A): Promise<boolean> => {
      const changed = await change(spaceIds, jobId, ...rest);
      if (changed) {
        await announce(spaceIds, jobId);
      }

      return changed;
    };

  // Called through the queue, never detached from it: a deployment's own queue may be a class that needs its `this`.
  return {
    pause: told((spaceIds, jobId) => queue.pause(spaceIds, jobId)),
    resume: told((spaceIds, jobId) => queue.resume(spaceIds, jobId)),
    cancel: told((spaceIds, jobId) => queue.cancel(spaceIds, jobId)),
    requeue: told((spaceIds, jobId, options?: Parameters<JobQueue['requeue']>[2]) =>
      queue.requeue(spaceIds, jobId, options)
    ),
    cancelWaiting: async query => {
      const dropped = await queue.cancelWaiting(query);
      // A few at a time: a queue emptied of thousands tells them all without opening as many reads at once.
      for (let from = 0; from < dropped.functionJobs.length; from += ANNOUNCED_AT_ONCE) {
        await Promise.all(
          dropped.functionJobs.slice(from, from + ANNOUNCED_AT_ONCE).map(jobId => announce(query.spaceIds, jobId))
        );
      }

      return dropped;
    }
  };
};
