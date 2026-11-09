import { serverLog } from '@plitzi/sdk-kernel/log';

import type { JobQueue } from '../../types';
import type { ActionLookups } from '../types';
import type { ActionDocument } from '@plitzi/sdk-shared';

/**
 * The queue, marking each action job it is given whose action runs the space's own code (`target.code`) — read off its
 * document as it is queued, wherever from: a schedule's fire, a run set for later, a call kept for when a runner is
 * back. What lets a worker whose runs wait for a runner with room go on taking the jobs that need none
 * (`claim({ takes: 'light' })`). A mark that misses costs only that: the job waits beside the others, as before.
 */
export const codeMarkingQueue = (
  queue: JobQueue,
  lookups: ActionLookups,
  runsCode: (document: ActionDocument) => boolean
): JobQueue => ({
  ...queue,
  enqueue: async job => {
    const { target } = job;
    if (target.kind !== 'action' || target.code) {
      return queue.enqueue(job);
    }

    // Its document unread — a store that did not answer — it is queued unmarked, never lost for a mark.
    const entry = await lookups.getAction(job.spaceId, target.name, target.at).catch((error: unknown) => {
      serverLog.warn(
        'Actions',
        `job ${job.id}: queued without reading whether its action runs the space's code`,
        error
      );

      return undefined;
    });

    return queue.enqueue(entry && runsCode(entry.document) ? { ...job, target: { ...target, code: true } } : job);
  }
});
