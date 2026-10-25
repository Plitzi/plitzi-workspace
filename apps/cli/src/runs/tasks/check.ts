import fs from 'node:fs/promises';
import path from 'node:path';

import { checkedStill, checkKey, keepChecked } from './checked';
import { LINT_CACHE_FILE } from '../../scaffold/paths';
import { checkAcceptance, letGo, serveForAcceptance } from '../acceptance';
import { handOver } from '../handOver';
import { crossed, longFilesIn, longFileText } from '../longFiles';
import { assertStatus, loadRun, logRun, readRunLog } from '../run';
import { backupFiles, backupText, tellLeftInTmp } from '../strays';
import { failureLines } from '../usage';
import { changedInCopy, findTask, holderOf, refreshCopy } from './common';
import { whoseChanges } from './complete';
import { fixChanged } from './fix';
import { againstRunWork, stepsNotOwn, tellUnanswered } from './notOwn';
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

/** How many lines of each failing step a check's log entry keeps: what it said, not all it printed. */
const WHY_LINES = 8;
export interface CheckedTask {
  ok: boolean;
  checks: CheckResult;
  /** Its acceptance's checks — none run while the project's checks fail. */
  accepted: AcceptanceResult[];
  /** Files past what is read whole: `complete` refuses them. */
  tooLong: string[];
  /** Backups an editor or `sed -i` left among its files: `complete` refuses them. */
  backups?: string[];
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
  /** Passed at this time, nothing changed since: the result said again, not run (`--fresh` runs it). */
  checkedAt?: string;
  /**
   * Failed as it does now at this time, on the same files: run again with nothing changed — a run's dev-1 checked
   * twelve times in nine minutes. Said, so the next run follows a change.
   */
  failedAlikeAt?: string;
  /**
   * What failed that is not this copy's work: steps the run's work fails the same way, acceptance lines nothing could
   * answer (the lead is told). Not counted against the agent; `complete` takes them as the run's.
   */
  notOwn?: string[];
}

export const checkTask = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  /**
   * `acceptance`: its commands alone, the copy served for them — what an agent iterating on one line runs, where the
   * whole check ran author, lint and typecheck again each time (52 of 88 failed checks were acceptance).
   */
  { only, fix = false, fresh = false }: { only?: 'acceptance'; fix?: boolean; fresh?: boolean } = {}
): Promise<CheckedTask> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'check a task');
  await tellLeftInTmp(ctx, loaded);
  const task = findTask(loaded, taskId);
  const view = await holderOf(ctx, loaded, task);
  const messages = await handOver(ctx, loaded, taskId, view.owner?.agent ?? ctx.agent);
  // Checked against the run and the project as they are now, as `complete` will be.
  const brought = await refreshCopy(ctx, loaded, view);
  // ESLint's answers are kept file by file, and a typed rule's depend on other files: a type fixed in an imported file
  // left its unchanged importers failing as before (a run's dev-3). Fresh is fresh: they are read again.
  if (fresh) {
    await fs.rm(path.join(view.paths.work, LINT_CACHE_FILE), { force: true });
  }

  const started = await readStart(view.paths);
  const mine = started ? await changedInCopy(view, started) : [];
  const { outside } = started ? await whoseChanges(loaded, view, mine, started) : { outside: [] };
  // Fixed on its own files alone: a run's dev-2 had `--fix` rewrite a file another task held, then refused for it.
  const othersFiles = new Set(outside.map(each => each.file));
  const fixed = fix
    ? await fixChanged(
        view.paths.work,
        ctx.root,
        mine.filter(file => !othersFiles.has(file))
      )
    : undefined;
  // Checked already, passing, and nothing changed since: said, not run again — `--fresh` runs it whatever.
  const before =
    only === undefined && !fresh && fixed === undefined && started
      ? await checkedStill(view.paths, await checkKey(loaded, view.paths, task, mine), ctx.now())
      : undefined;
  // The copy served for the acceptance while the project's checks run: what came after them, beside them.
  const where = { work: view.paths.work, root: ctx.root, cache: view.paths.cache };
  const serving = before ? undefined : serveForAcceptance(task.acceptance, where);
  let accepted: Awaited<ReturnType<typeof checkAcceptance>> = before?.accepted ?? [];
  let checks: CheckResult = before?.checks ?? { ok: true, steps: [] };
  let notOwnSteps: string[] = [];
  try {
    if (!before) {
      checks = only === 'acceptance' ? checks : await ctx.checks(view.paths.work, ctx.root);
      notOwnSteps = checks.ok
        ? []
        : stepsNotOwn(checks, await againstRunWork(ctx, loaded, view, checks)).map(step => step.name);
      // What fails for nothing of the copy's stops nothing of it: a run's t-home went to review with its acceptance
      // unrun, for a warning the run's work had too.
      const ownFailing = checks.steps.filter(step => !step.ok && !notOwnSteps.includes(step.name));
      accepted =
        ownFailing.length === 0
          ? await checkAcceptance(task.acceptance, { ...where, ...(serving ? { serving } : {}) })
          : [];
    }
  } finally {
    await letGo(serving);
  }

  const tooLong = (await longFilesIn(view.paths.work, ctx.root)).filter(crossed).map(longFileText);
  const backups = backupFiles(mine);
  const ok =
    backups.length === 0 &&
    checks.ok &&
    accepted.every(each => each.ok) &&
    tooLong.length === 0 &&
    outside.length === 0;
  const notOwn = [
    ...notOwnSteps,
    ...(await tellUnanswered(ctx, loaded, taskId, accepted)).map(each => `acceptance — ${each.said}`)
  ];
  // What it was run on — the copy's files, the run's approved work, the lines, the CLI — after any `--fix`: one input
  // checked twice with two outcomes is a check that is not deterministic (a run's 409s "passing on rerun").
  const key = started ? await checkKey(loaded, view.paths, task, await changedInCopy(view, started)) : undefined;
  const failed = [
    ...backups.map(backupText),
    ...checks.steps.filter(step => !step.ok).map(step => step.name),
    ...accepted.filter(each => !each.ok).map(each => `acceptance — ${each.said}`),
    ...tooLong,
    ...outside.map(each => `${each.file} is ${each.holder}'s`)
  ];
  const input = key?.slice(0, 16);
  const lastAlike =
    !ok && input !== undefined
      ? (await readRunLog(loaded.paths)).findLast(
          entry =>
            entry.action === 'check' &&
            entry.task === taskId &&
            entry.ok === false &&
            entry.input === input &&
            JSON.stringify(entry.failed) === JSON.stringify(failed)
        )
      : undefined;
  // Passed whole: kept for the complete that follows, which does not run it all again while nothing changes.
  if (ok && only === undefined && key !== undefined) {
    await keepChecked(view.paths, key, { checks, accepted }, ctx.now());
  }
  // What failed, by name: a run's activity says why a check did not pass, not only that it did not.
  await logRun(ctx, loaded.paths, {
    action: 'check',
    task: taskId,
    ok,
    ...(key === undefined || before ? {} : { input: key.slice(0, 16), ...(only ? { only } : {}) }),
    ...(ok
      ? {}
      : {
          failed,
          ...(notOwn.length > 0 ? { notOwn } : {}),
          // Why, each in its own words: what a fix is read from, never run again to find out (a run's t-gallery).
          why: [
            ...checks.steps
              .filter(step => !step.ok)
              .map(step => ({ step: step.name, said: failureLines((step.said ?? []).join('\n')).slice(0, WHY_LINES) })),
            ...accepted
              .filter(each => !each.ok)
              .map(each => ({
                step: `acceptance — ${each.said}`,
                said: failureLines((each.output ?? []).join('\n')).slice(0, WHY_LINES)
              }))
          ]
        })
  });

  return {
    ok,
    checks,
    accepted,
    tooLong,
    ...(backups.length > 0 ? { backups } : {}),
    messages,
    ...(brought.length > 0 ? { brought } : {}),
    ...(only ? { only } : {}),
    ...(outside.length > 0 ? { othersFiles: outside } : {}),
    ...(fixed ? { fixed } : {}),
    ...(before ? { checkedAt: before.at } : {}),
    ...(typeof lastAlike?.at === 'string' ? { failedAlikeAt: lastAlike.at } : {}),
    ...(notOwn.length > 0 ? { notOwn } : {})
  };
};
