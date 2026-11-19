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

/** How many of the jobs moved at once (`cancelWaiting`, `resumeWaiting`) have their watchers told at a time. */
const ANNOUNCED_AT_ONCE = 20;

export type JobControl = Pick<JobQueue, 'pause' | 'resume' | 'cancel' | 'requeue' | 'cancelWaiting' | 'resumeWaiting'>;

/**
 * An operator's hold on the jobs, from a process that serves no pages — a deployment's API behind its Queue panel: the
 * queue's own `pause`, `resume`, `cancel`, `requeue`, `cancelWaiting` and `resumeWaiting`, each said on `$job:<id>` when it
 * changed a job of the spaces' functions, as the page server says it when its code does the same.
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

  // A few at a time: a queue of thousands moved at once tells them all without opening as many reads at once.
  const announceAll = async (spaceIds: number[], jobIds: string[]): Promise<void> => {
    for (let from = 0; from < jobIds.length; from += ANNOUNCED_AT_ONCE) {
      await Promise.all(jobIds.slice(from, from + ANNOUNCED_AT_ONCE).map(jobId => announce(spaceIds, jobId)));
    }
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
      await announceAll(query.spaceIds, dropped.functionJobs);

      return dropped;
    },
    resumeWaiting: async query => {
      const resumed = await queue.resumeWaiting(query);
      await announceAll(query.spaceIds, resumed.functionJobs);

      return resumed;
    }
  };
};
