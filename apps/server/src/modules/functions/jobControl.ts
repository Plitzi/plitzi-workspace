import { jobViewOf } from './jobs';
import { serverLog } from '../../helpers/serverLog';
import { createRealtimeHub } from '../realtime/hub';
import { publishJobView } from '../realtime/jobs';
import { createRealtimeRetained } from '../realtime/retained';

import type { ActionKvAdapter } from '../actions/types';
import type { JobQueue, PubSubAdapter } from '@plitzi/sdk-shared';

export type JobControlOptions = {
  queue: JobQueue;
  /**
   * The page server's realtime — the pub/sub its replicas listen on and the `kv` its retained messages are kept in — so
   * whoever watches a job hears what an operator did to it. Absent, the queue changes and nobody is told until the job
   * moves again.
   */
  realtime?: { pubsub: PubSubAdapter; kv: ActionKvAdapter };
};

export type JobControl = Pick<JobQueue, 'pause' | 'resume' | 'cancel' | 'requeue'>;

/**
 * An operator's hold on the jobs, from a process that serves no pages — a deployment's API behind its Queue panel: the
 * queue's own `pause`, `resume`, `cancel` and `requeue`, each said on `$job:<id>` when it changed a job of the spaces'
 * functions, as the page server says it when its code does the same.
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
    )
  };
};
