import type { JobQueue, JobWake } from '../../types';

/**
 * How soon a job counts as due now, for telling the workers: one due within it is worth waking them for, and one due
 * later is found by their looking. Read off this process's clock — a notice early or late costs a look, never a run.
 */
const DUE_SOON_MS = 1_000;

/**
 * The queue, telling the workers (`wake.notify`) as a job due now is enqueued or handed back due: a retry with no delay,
 * a worker's shutdown giving its claims back. What a worker hears it looks at once, rather than on its next look.
 */
export const wakingQueue = (queue: JobQueue, wake: JobWake | undefined): JobQueue =>
  wake
    ? {
        ...queue,
        enqueue: async job => {
          const created = await queue.enqueue(job);
          if (created && job.dueAt <= Date.now() + DUE_SOON_MS) {
            wake.notify();
          }

          return created;
        },
        settle: async settlement => {
          await queue.settle(settlement);
          if (settlement.status === 'pending' && (settlement.delayMs ?? 0) <= DUE_SOON_MS) {
            wake.notify();
          }
        }
      }
    : queue;
