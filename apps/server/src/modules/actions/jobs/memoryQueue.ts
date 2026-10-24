import { applyRule, emptyState, queueOver, queueRules } from './queueRules';

import type { StoreMethods } from '../../../core/server/fleet/channel';
import type { JobQueue } from '@plitzi/sdk-shared';

export type MemoryJobQueueOptions = {
  /**
   * How many finished jobs to keep before the oldest are dropped.
   *
   * A bound rather than a retention period, because this store has no eviction of its own and an unbounded history
   * in a long-lived process is a leak with a nice name. A deployment that wants jobs it can still read next week
   * supplies a queue backed by something that survives a restart.
   */
  retainFinished?: number;
  /**
   * What this queue calls now, in epoch ms.
   *
   * The seam that makes a lease, a backoff and an overdue schedule testable without waiting for one — and the
   * shape of the rule a shared store keeps too: everything here reads ONE clock, and it is the store's.
   */
  clock?: () => number;
};

/** Every method of the queue, for the copy a server's workers share (see `fleet/stores.ts`). */
export const JOB_QUEUE_METHODS: StoreMethods<JobQueue> = {
  now: true,
  enqueue: true,
  claim: true,
  heartbeat: true,
  settle: true,
  write: true,
  dueSchedules: true,
  advanceSchedule: true,
  putSchedules: true,
  listJobs: true,
  getJob: true,
  listSchedules: true,
  requeue: true,
  cancel: true,
  pause: true,
  resume: true,
  cancelPending: true
};

/**
 * The default queue: one process's Maps.
 *
 * Correct for a deployment that runs ONE replica, which is most self-hosted ones, and honest about the rest — a
 * second replica running on this gets its own schedules and its own jobs, so a nightly digest goes out twice. The
 * cure is any store the replicas share, behind the same {@link JobQueue} seam.
 *
 * It keeps the contract exactly, rather than approximately: enqueue is idempotent by id, a claim reaps lapsed
 * leases, and every instant is read here rather than accepted from a caller. A test that passes against this one
 * is testing the rules a shared store has to keep too.
 */
export const createMemoryJobQueue = ({
  retainFinished = 500,
  clock = Date.now
}: MemoryJobQueueOptions = {}): JobQueue => {
  const rules = queueRules(emptyState(), { retainFinished, clock });

  return queueOver((method, args) => Promise.resolve(applyRule(rules, method, args)));
};
