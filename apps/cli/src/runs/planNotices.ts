import { runsSuite } from './acceptance';
import { SCOPE_LIMIT_MINUTES, WORK_LIMIT_MINUTES, workLimitOf } from './limits';
import { scriptsOf } from '../commands/verify';

import type { RunTask } from './model';

/** What `run plan` says of a plan's size and checks, against the time a piece of work and a check should take. */

/**
 * Past the limit a piece of work takes before something is usually wrong (`workLimitOf`): a task that size is several,
 * and a spike after the scope is small — what the agents find as they go (Carlos).
 */
export const sizeNotices = (tasks: readonly RunTask[]): string[] => {
  const large = tasks.filter(task => task.kind === 'work' && task.estimateMinutes > workLimitOf(task.id));

  return large.length === 0
    ? []
    : [
        `Estimated past the ${String(WORK_LIMIT_MINUTES)} min a piece of work takes before something is usually wrong (the scope ${String(SCOPE_LIMIT_MINUTES)}): ${large.map(task => `${task.id} ${String(task.estimateMinutes)} min`).join(', ')} — split each by what changes apart, a spike into the question each answers; the lead is woken past the limit`
      ];
};

/**
 * A line that runs a whole Playwright suite with no spec named: minutes of every check, the finish's work — the task's
 * own specs are what it holds (encore-10's t-visual-specs ran the whole suite twice a line, 148 min of 60).
 */
export const suiteNotices = async (root: string, tasks: readonly RunTask[]): Promise<string[]> => {
  const names = Object.entries(await scriptsOf(root).catch(() => ({})))
    .filter(([, script]) => /\bplaywright\s+test\b/.test(script))
    .map(([name]) => name);
  const whole = [
    ...new Set(
      tasks.flatMap(task =>
        task.acceptance.flatMap(line =>
          typeof line !== 'string' && runsSuite(line.check, names) && !/\.spec\.[cm]?[jt]sx?\b/.test(line.check)
            ? [task.id]
            : []
        )
      )
    )
  ];

  return whole.length === 0
    ? []
    : [
        `A line of ${whole.join(', ')} runs a whole Playwright suite: name the task's own specs (npx playwright test <spec> …) — a check takes minutes at most, and the finish runs the whole result once`
      ];
};
