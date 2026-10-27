import path from 'node:path';

import { digestsOf, escapeRegExp } from './approve';
import { failedWhy } from '../../commands/project/verify';
import { ownFailing } from '../copies/checks';
import { checkVersions } from '../copies/materialise';
import { openUnanswered } from '../copies/unansweredLines';
import { logRun, readApproved, readRunLog } from '../run';

import type { CheckResult, CheckStep } from '../copies/checks';
import type { AcceptanceResult } from '../core/model';
import type { TaskView } from '../core/taskStore';
import type { LoadedRun, RunContext } from '../run';

/**
 * What fails in a copy that is not its agent's work: a step the run's work fails the same way without it (another
 * task's approval, a person's edit), and an acceptance line nothing could answer (the line's, or the machine's). Said
 * apart, so a run's failed checks count the work alone (72% of its checks failed, most of them for neither).
 */

/** The copy's checks beside the run's work without it: what `ownFailing` reads them with. */
export interface AgainstRunWork {
  /** The run's work checked as approved — none while the copy's checks pass. */
  without?: CheckResult;
  /** The copy's own folders, which its checks' output names and the run's does not. */
  dirs: (string | RegExp)[];
}

export const againstRunWork = async (
  ctx: RunContext,
  loaded: LoadedRun,
  view: TaskView,
  checks: CheckResult
): Promise<AgainstRunWork> => ({
  without: checks.ok ? undefined : await checkVersions(ctx, loaded, digestsOf(await readApproved(loaded.paths))),
  dirs: [
    `${view.paths.work}${path.sep}`,
    new RegExp(`${escapeRegExp(path.join(loaded.paths.cache, 'check-'))}[0-9a-f]+${escapeRegExp(path.sep)}`, 'g')
  ]
});

/** The failing steps that are not the copy's: those the run's work fails the same way. */
export const stepsNotOwn = (checks: CheckResult, { without, dirs }: AgainstRunWork): CheckStep[] => {
  if (without === undefined) {
    return [];
  }

  const own = new Set(ownFailing(checks, without, dirs).map(step => step.name));

  return checks.steps.filter(step => !step.ok && !own.has(step.name));
};

/**
 * Tells the lead, once a line, of the acceptance lines of a task nothing could answer: the line is the lead's to amend,
 * and every try of the task fails on it until then.
 */
export const tellUnanswered = async (
  ctx: RunContext,
  loaded: LoadedRun,
  taskId: string,
  accepted: readonly AcceptanceResult[]
): Promise<AcceptanceResult[]> => {
  const unanswered = accepted.filter(result => result.unanswered === true);
  if (unanswered.length === 0) {
    return [];
  }

  // Logged once a line, until its task's acceptance is amended: the lead is woken for it (`unansweredLines`).
  const open = openUnanswered(await readRunLog(loaded.paths));
  for (const line of unanswered.filter(each => !open.has(`${taskId}\u0000${each.check}`))) {
    await logRun(ctx, loaded.paths, {
      action: 'line-unanswered',
      task: taskId,
      said: line.said,
      check: line.check,
      why: failedWhy(line.output) ?? 'it read nothing'
    });
  }

  return unanswered;
};
