import { buildMergeIntoRun, buildRequestsMerge, checkDirs, digestsOf } from './approve';
import { failsWithout } from '../copies/checks';
import { checkVersions } from '../copies/materialise';
import { isRunRefusal } from '../core/refusal';
import { keepFiles } from '../core/store';
import { readRequests, readStart } from '../core/taskStore';
import { readApproved } from '../run';

import type { TaskView } from '../core/taskStore';
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
  /** Its own failing steps on the result — what `--approve` refuses. */
  failing?: string[];
  /** Steps the result fails as the run's work already did without it: not its own, and no refusal. */
  runFails?: string[];
  /** Why it could not be put together: the same lines changed, a file made twice — the approval refuses it too. */
  conflict?: string;
}

export const mergedNow = async (ctx: RunContext, loaded: LoadedRun, view: TaskView): Promise<MergedNow | undefined> => {
  const start = await readStart(view.paths);
  if (!start) {
    return undefined;
  }

  const approved = await readApproved(loaded.paths);
  // Not the version its copy holds: approved since, by another — its copy and its checks never saw it.
  const since = [
    ...new Set(
      Object.entries(approved.files)
        .filter(([file, entry]) => entry.task !== view.task.id && start.files[file] !== entry.digest)
        .map(([, entry]) => entry.task)
    )
  ];
  if (since.length === 0) {
    return undefined;
  }

  const submitted = view.state.submitted ?? (await keepFiles(loaded.paths, view.paths.work, view.state.changed ?? []));
  const asked = (await readRequests(view.paths)).filter(request => !Object.hasOwn(submitted, request.file));
  try {
    const files = await buildMergeIntoRun(ctx, loaded, view, start, submitted, 'refuse', approved);
    const withAsked = await buildRequestsMerge(
      ctx,
      loaded,
      asked.map(request => ({ view, request })),
      files.next
    );
    const checks = await checkVersions(ctx, loaded, digestsOf((withAsked ?? files).next));
    if (checks.ok) {
      return { since };
    }

    const failing = checks.steps.filter(step => !step.ok).map(step => step.name);
    const without = await checkVersions(ctx, loaded, digestsOf(approved));

    return failsWithout(checks, without, [checkDirs(loaded.paths.cache)])
      ? { since, runFails: failing }
      : { since, failing };
  } catch (error) {
    if (isRunRefusal(error) && error.code === 'conflict') {
      return { since, conflict: error.message };
    }

    throw error;
  }
};
