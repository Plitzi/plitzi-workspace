import { checkAcceptance } from '../acceptance';
import { crossed, longFilesIn, longFileText } from '../longFiles';
import { assertStatus, loadRun, logRun } from '../run';
import { findTask, holderOf } from './common';

import type { CheckResult } from '../checks';
import type { AcceptanceResult } from '../model';
import type { RunContext } from '../run';

/**
 * `plitzi task check`: what `complete` would hold the copy to — the project's checks, the acceptance's commands, the
 * files too long to read whole — run as the copy is now, and said. Nothing changes: the task stays in hand, and a check
 * that fails here is not counted by the run's brake, which is for what reaches review — so an agent iterating on a fix
 * among many does not stop the run.
 */

export interface CheckedTask {
  ok: boolean;
  checks: CheckResult;
  /** Its acceptance's checks — none run while the project's checks fail. */
  accepted: AcceptanceResult[];
  /** Files past what is read whole: `complete` refuses them. */
  tooLong: string[];
}

export const checkTask = async (ctx: RunContext, runId: string, taskId: string): Promise<CheckedTask> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'check a task');
  const task = findTask(loaded, taskId);
  const view = await holderOf(ctx, loaded, task);
  const checks = await ctx.checks(view.paths.work, ctx.root);
  const accepted = checks.ok
    ? await checkAcceptance(task.acceptance, { work: view.paths.work, root: ctx.root, cache: view.paths.cache })
    : [];
  const tooLong = (await longFilesIn(view.paths.work, ctx.root)).filter(crossed).map(longFileText);
  const ok = checks.ok && accepted.every(each => each.ok) && tooLong.length === 0;
  await logRun(ctx, loaded.paths, { action: 'check', task: taskId, ok });

  return { ok, checks, accepted, tooLong };
};
