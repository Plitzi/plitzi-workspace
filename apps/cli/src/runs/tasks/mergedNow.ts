import { checkDirs, digestsOf } from './approve';
import { mergedVersion } from './mergedVersion';
import { failsWithout, ownFailingLines } from '../copies/checks';
import { checkVersions } from '../copies/materialise';

import type { TaskView } from '../../core/taskStore';
import type { CheckStep } from '../copies/checks';
import type { LoadedRun, RunContext } from '../run';

/**
 * A task in review as its approval will put it in: its change together with what the run approved since its copy was
 * made, under the project's checks — said when its review is taken, not at `--approve` once the review is done (a run's
 * tester found a merge failing only by copying both into its scratch, and another learned it from the refused approve).
 * A pass is kept by its tree (`checkVersions`), so the approval that follows reads it again rather than running them.
 */
export interface MergedNow {
  /** The tasks whose work was approved since its copy was made: what its approval puts together with it. */
  since: string[];
  /** Its own failing steps on the result — what `--approve` refuses — each with the lines the run's work does not print. */
  failing?: CheckStep[];
  /** Steps the result fails as the run's work already did without it: not its own, and no refusal. */
  runFails?: string[];
  /** Why it could not be put together: the same lines changed, a file made twice — the approval refuses it too. */
  conflict?: string;
}

export const mergedNow = async (ctx: RunContext, loaded: LoadedRun, view: TaskView): Promise<MergedNow | undefined> => {
  const merged = await mergedVersion(ctx, loaded, view);
  if (!merged || merged.since.length === 0) {
    return undefined;
  }

  const { since } = merged;
  if ('conflict' in merged) {
    return { since, conflict: merged.conflict };
  }

  const checks = await checkVersions(ctx, loaded, digestsOf(merged.next));
  if (checks.ok) {
    return { since };
  }

  const without = await checkVersions(ctx, loaded, digestsOf(merged.approved));
  const dirs = [checkDirs(loaded.paths.cache)];

  return failsWithout(checks, without, dirs)
    ? { since, runFails: checks.steps.filter(step => !step.ok).map(step => step.name) }
    : { since, failing: ownFailingLines(checks, without, dirs) };
};
