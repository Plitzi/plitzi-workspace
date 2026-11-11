import fs from 'node:fs/promises';
import path from 'node:path';

import { buildMergeIntoRun, buildRequestsMerge, digestsOf } from './approve';
import { isRunRefusal } from '../../core/refusal';
import { getBlob, keepFiles } from '../../core/store';
import { readRequests, readStart } from '../../core/taskStore';
import { materialise } from '../copies/materialise';
import { readApproved } from '../run';

import type { ApprovedManifest } from '../../core/model';
import type { TaskView } from '../../core/taskStore';
import type { LoadedRun, RunContext } from '../run';

/**
 * A task as its approval would put it in: its change, and what it asked of others' files, together with what the run
 * approved since its copy was made — the one merge `--approve` makes, made without approving. What a reviewer reads
 * (`task show --merged`), looks at (`task look --merged`) and is warned of (`mergedNow`): a run's tester put the merge
 * together by hand in its scratch to find the error its review only named.
 */
export type MergedVersion =
  | {
      /** The tasks whose work was approved since its copy was made: none, and the merge is its copy. */
      since: string[];
      /** The run's work as it is: what the merge is laid over. */
      approved: ApprovedManifest;
      /** The run's work with it in. */
      next: ApprovedManifest;
    }
  | {
      since: string[];
      /** Why it does not go in: the same lines changed, a file made twice — what the approval refuses too. */
      conflict: string;
    };

/** Its merge, or undefined for a task with no copy to merge — never taken, or approved already. */
export const mergedVersion = async (
  ctx: RunContext,
  loaded: LoadedRun,
  view: TaskView
): Promise<MergedVersion | undefined> => {
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

    return { since, approved, next: (withAsked ?? files).next };
  } catch (error) {
    if (isRunRefusal(error) && error.code === 'conflict') {
      return { since, conflict: error.message };
    }

    throw error;
  }
};

/** One file of a merge: as the run holds it now, and as it would with the task in — undefined where there is none. */
export const mergedFile = async (
  loaded: LoadedRun,
  merged: Extract<MergedVersion, { next: ApprovedManifest }>,
  file: string
): Promise<{ run?: Buffer; merged?: Buffer }> => {
  const read = async (manifest: ApprovedManifest): Promise<Buffer | undefined> => {
    const digest = Object.hasOwn(manifest.files, file) ? manifest.files[file].digest : undefined;

    return digest === undefined || digest === null ? undefined : getBlob(loaded.paths, digest);
  };
  const [run, after] = await Promise.all([read(merged.approved), read(merged.next)]);

  return { ...(run ? { run } : {}), ...(after ? { merged: after } : {}) };
};

/**
 * The merge as a folder of the project, in the task's cache — what `task look --merged` serves: made afresh each time,
 * so nothing of a look before it stays.
 */
export const materialiseMerged = async (
  ctx: RunContext,
  loaded: LoadedRun,
  view: TaskView,
  merged: Extract<MergedVersion, { next: ApprovedManifest }>
): Promise<string> => {
  const made = await materialise(ctx, loaded, digestsOf(merged.next));
  const dir = path.join(view.paths.cache, 'merged');
  await fs.rm(dir, { recursive: true, force: true });
  await fs.rename(made, dir);

  return dir;
};
