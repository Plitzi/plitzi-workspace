import { isPrincipal, takeOnLook } from '../../runs/leads';
import { loadRun, logRun } from '../../runs/run';
import { viewTask } from '../../runs/taskStore';

import type { RunContext } from '../../runs/run';

/**
 * A tester's read of a task in review — its look, its show — takes the review (the lead's, one no tester may take), said
 * in the activity: the board names the task it is at, and another tester is not offered it. A run's lead read with `task show` and the
 * monitor said only "working", never which task.
 */
export const takeOnRead = async (ctx: RunContext, runId: string, taskId: string): Promise<void> => {
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  const task = loaded.tasks.find(each => each.id === taskId);
  if (task && (await takeOnLook(ctx, loaded, await viewTask(loaded.paths, task)))) {
    // As `task next` says a tester's: its QA — the lead's, `lead`.
    await logRun(ctx, loaded.paths, {
      action: 'review-taken',
      task: taskId,
      review: isPrincipal(ctx.agent) ? 'lead' : 'QA'
    });
  }
};
