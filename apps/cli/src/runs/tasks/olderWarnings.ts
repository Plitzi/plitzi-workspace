import { digestsOf } from './approve';
import { checkVersions } from '../copies/materialise';
import { readApproved, readRunLog } from '../run';
import { logNotice, noticesIn } from '../talk/notices';

import type { LoadedRun, RunContext } from '../run';

/**
 * The space lint's warnings in the files a task changed, told apart: those it added, its own to fix, and those its files
 * had in the run's work before it — the project's, kept for its backlog (`keepOlderWarnings`). A warning is its file and
 * its rule (`src/x.ts:7 positional-id`): its line moves with any edit above it, so they are counted by file and rule —
 * one more of a kind than the run's work holds is the task's.
 */

/** A warning without its line: what one is told apart by. */
const kindOf = (warning: string): string => warning.replace(/:\d+(?= )/, '');

export const warningsAgainstRun = async (
  ctx: RunContext,
  loaded: LoadedRun,
  warned: readonly string[]
): Promise<{ own: string[]; before: string[] }> => {
  const run = await checkVersions(ctx, loaded, digestsOf(await readApproved(loaded.paths)));
  const left = new Map<string, number>();
  for (const warning of run.steps.find(step => step.name === 'lint:space')?.warnings ?? []) {
    left.set(kindOf(warning), (left.get(kindOf(warning)) ?? 0) + 1);
  }

  const own: string[] = [];
  const before: string[] = [];
  for (const warning of warned) {
    const there = left.get(kindOf(warning)) ?? 0;
    if (there > 0) {
      left.set(kindOf(warning), there - 1);
      before.push(warning);
    } else {
      own.push(warning);
    }
  }

  return { own, before };
};

/** The words a kept warning is noticed with: the same each time, so a task completing again notices it once. */
const noticeOf = (warning: string): string =>
  `The space's lint warns ${warning} — there before this run's change to the file: the project's to fix`;

/** The older warnings kept as the run's notices — once each — for the project's backlog when the run ends. */
export const keepOlderWarnings = async (
  ctx: RunContext,
  loaded: LoadedRun,
  taskId: string,
  warnings: readonly string[]
): Promise<string[]> => {
  if (warnings.length === 0) {
    return [];
  }

  const noticed = new Set(noticesIn(await readRunLog(loaded.paths)).map(notice => notice.text));
  for (const warning of warnings.filter(each => !noticed.has(noticeOf(each)))) {
    await logNotice(ctx, loaded, noticeOf(warning), { task: taskId, on: warning.split(/[: ]/)[0] ?? '' });
  }

  return [...warnings];
};
