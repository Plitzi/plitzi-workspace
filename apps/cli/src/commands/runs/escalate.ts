import { act, runOf } from './shell';
import { RunRefusal } from '../../runs/refusal';
import { escalateReview } from '../../runs/tasks';

import type { ReviewOptions } from './review';

/** `plitzi task review <task> --escalate "…"`: a tester's review handed to the lead to decide. */
export const taskEscalate = (taskId: string, options: ReviewOptions & { escalate: string }): Promise<void> =>
  act(
    options,
    async ctx => {
      if (options.approve === true || options.changes !== undefined) {
        throw new RunRefusal('invalid', '--escalate is the review itself: leave out --approve and --changes');
      }

      return escalateReview(ctx, await runOf(ctx, options), taskId, options.escalate);
    },
    () =>
      `${taskId} goes to the lead to decide: it approves it, or sends it back with an answer. Your review is done — plitzi task next`
  );
