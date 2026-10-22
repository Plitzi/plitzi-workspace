import { checkAcceptance } from '../acceptance';
import { handOver } from '../handOver';
import { crossed, longFilesIn, longFileText } from '../longFiles';
import { assertStatus, loadRun, logRun } from '../run';
import { tellLeftInTmp } from '../strays';
import { changedInCopy, findTask, holderOf, refreshCopy } from './common';
import { whoseChanges } from './complete';
import { fixChanged } from './fix';
import { readStart } from '../taskStore';

import type { CheckResult } from '../checks';
import type { Message } from '../messages';
import type { AcceptanceResult } from '../model';
import type { RunContext } from '../run';

/**
 * `plitzi task check`: what `complete` would hold the copy to — the project's checks, the acceptance's commands, the
 * files too long to read whole — run as the copy is now, and said. What the run approved, or a person changed in the
 * project, since the copy was made comes in first, as at `complete`; nothing else changes: the task stays in hand, and a check
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
  /**
   * What was said to the task and its agent and not read: an agent iterating checks, and runs no other command until it
   * completes — a change the lead asked meanwhile reaches it here, not after it went to review.
   */
  messages: Message[];
  /** What came into the copy first: approved since it was made, or changed in the project by a person. */
  brought?: string[];
  /** `acceptance`: only the acceptance's commands were run — the project's checks were not, and `complete` runs them. */
  only?: 'acceptance';
  /** Files it changed that another task at work holds: `complete` refuses them — said now, before the work is done. */
  othersFiles?: { file: string; holder: string }[];
  /** `--fix`: the project's linter and formatter ran on its files first — which they rewrote, and which ran. */
  fixed?: { fixed: string[]; ran: string[] };
}

export const checkTask = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  /**
   * `acceptance`: its commands alone, the copy served for them — what an agent iterating on one line runs, where the
   * whole check ran author, lint and typecheck again each time (la-velada: 52 of 88 failed checks were acceptance).
   */
  { only, fix = false }: { only?: 'acceptance'; fix?: boolean } = {}
): Promise<CheckedTask> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'check a task');
  await tellLeftInTmp(ctx, loaded);
  const task = findTask(loaded, taskId);
  const view = await holderOf(ctx, loaded, task);
  const messages = await handOver(ctx, loaded, taskId, view.owner?.agent ?? ctx.agent);
  // Checked against the run and the project as they are now, as `complete` will be.
  const brought = await refreshCopy(ctx, loaded, view);
  const started = await readStart(view.paths);
  const mine = started ? await changedInCopy(view, started) : [];
  const fixed = fix ? await fixChanged(view.paths.work, ctx.root, mine) : undefined;
  const checks: CheckResult =
    only === 'acceptance' ? { ok: true, steps: [] } : await ctx.checks(view.paths.work, ctx.root);
  const accepted = checks.ok
    ? await checkAcceptance(task.acceptance, { work: view.paths.work, root: ctx.root, cache: view.paths.cache })
    : [];
  const tooLong = (await longFilesIn(view.paths.work, ctx.root)).filter(crossed).map(longFileText);
  const { outside } = started ? await whoseChanges(loaded, view, mine, started) : { outside: [] };
  const ok = checks.ok && accepted.every(each => each.ok) && tooLong.length === 0 && outside.length === 0;
  // What failed, by name: a run's activity says why a check did not pass, not only that it did not.
  await logRun(ctx, loaded.paths, {
    action: 'check',
    task: taskId,
    ok,
    ...(ok
      ? {}
      : {
          failed: [
            ...checks.steps.filter(step => !step.ok).map(step => step.name),
            ...accepted.filter(each => !each.ok).map(each => `acceptance — ${each.said}`),
            ...tooLong,
            ...outside.map(each => `${each.file} is ${each.holder}'s`)
          ]
        })
  });

  return {
    ok,
    checks,
    accepted,
    tooLong,
    messages,
    ...(brought.length > 0 ? { brought } : {}),
    ...(only ? { only } : {}),
    ...(outside.length > 0 ? { othersFiles: outside } : {}),
    ...(fixed ? { fixed } : {})
  };
};
