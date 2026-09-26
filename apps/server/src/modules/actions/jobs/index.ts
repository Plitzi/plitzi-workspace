import { createMemoryJobQueue, JOB_QUEUE_METHODS } from './memoryQueue';
import { createScheduler } from './scheduler';
import { createJobWorker } from './worker';
import { fleetStore } from '../../../core/server/fleet/link';

import type { Scheduler } from './scheduler';
import type { JobWorker } from './worker';
import type { ActionsModule } from '../index';
import type { ActionJobsConfig, ActionLookups } from '../types';
import type { ActionJobQueue } from '@plitzi/sdk-shared';

export type ActionJobs = {
  queue: ActionJobQueue;
  scheduler: Scheduler;
  worker: JobWorker;
  start: () => void;
  stop: () => Promise<void>;
};

/**
 * The scheduling half of actions: a producer, a consumer and the store they meet in.
 *
 * Both halves run in EVERY replica by default, and neither needs to know about the others. The producer is safe to
 * duplicate because a fire's job id is the fire's own instant; the consumer is safe to duplicate because a claim is
 * atomic. What a deployment tunes is how many jobs each replica carries (`workers`) and whether it produces at all
 * — a pod dedicated to running jobs sets `produce: false`, a pod serving pages sets `workers: 0`.
 *
 * With no `queue` supplied this is one process's memory, which is right for a single replica and wrong the moment
 * there are two. That is a sentence rather than a silent behaviour because the failure is invisible: everything
 * works, and the nightly email goes out once per replica. The workers of one server are one replica: they share
 * the primary's queue, and only one of them runs the scheduler and the jobs (`runsFleetJobs`).
 */
export const createActionJobs = (
  config: ActionJobsConfig,
  module: ActionsModule,
  lookups: ActionLookups
): ActionJobs => {
  const queue = config.queue ?? fleetStore<ActionJobQueue>('actions.jobs', JOB_QUEUE_METHODS) ?? createMemoryJobQueue();
  const { produce = true, workers = 4 } = config;

  const scheduler = createScheduler({
    queue,
    lookups,
    ...(config.environment ? { environment: config.environment } : {}),
    ...(config.schedulePollMs ? { pollMs: config.schedulePollMs } : {}),
    ...(config.maxAttempts ? { maxAttempts: config.maxAttempts } : {}),
    ...(config.reconcileMs ? { reconcileMs: config.reconcileMs } : {}),
    ...(config.spaces ? { spaces: config.spaces } : {}),
    ...(config.onError ? { onError: config.onError } : {})
  });

  const worker = createJobWorker({
    queue,
    lookups,
    module,
    workers,
    ...(config.pollMs ? { pollMs: config.pollMs } : {}),
    ...(config.leaseMs ? { leaseMs: config.leaseMs } : {}),
    ...(config.backoff ? { backoff: config.backoff } : {}),
    ...(config.workerId ? { workerId: config.workerId } : {}),
    ...(config.onError ? { onError: config.onError } : {})
  });

  return {
    queue,
    scheduler,
    worker,
    start: () => {
      if (produce) {
        scheduler.start();
      }

      worker.start();
    },
    stop: async () => {
      scheduler.stop();
      await worker.stop();
    }
  };
};

export { createMemoryJobQueue } from './memoryQueue';
export { createScheduler } from './scheduler';
export { createJobWorker } from './worker';
export { DEFAULT_MAX_ATTEMPTS, scheduleFor, scheduleJobId, schedulesFor } from './schedules';

export type { MemoryJobQueueOptions } from './memoryQueue';
export type { Scheduler, SchedulerOptions, SweepResult } from './scheduler';
export type { JobWorker, JobWorkerOptions } from './worker';
