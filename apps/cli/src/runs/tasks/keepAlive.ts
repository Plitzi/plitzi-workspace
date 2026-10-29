import { readJson, writeJson } from '../core/files';
import { isTaskProgress } from '../core/model';

import type { TaskProgress } from '../core/model';
import type { TaskView } from '../core/taskStore';

/** How often a long check gives its task's sign of life: well inside what reads "no signal". */
export const KEEP_ALIVE_MS = 60_000;

const readProgress = (view: TaskView): Promise<TaskProgress | undefined> =>
  readJson(view.paths.progress, isTaskProgress, 'its progress').catch(() => undefined);

/**
 * Runs `work` — a task's checks, its acceptance's commands, a suite waiting its turn on the machine — giving the task's
 * sign of life while it runs: an agent inside one long command can give none, and its live task read "no signal —
 * reassign it" (a run's dev-1 in a whole suite pass). The time is said apart (`checking`, `checkedMs`): it is the
 * checks', not the agent's — a run asked "where do you stand?" of an agent four minutes into its page's spec, and the
 * question then refused the very complete that answered it.
 */
export const keepAlive = async <T>(view: TaskView, now: () => Date, work: () => Promise<T>): Promise<T> => {
  const since = now();
  const write = async (change: (progress: TaskProgress) => TaskProgress): Promise<void> => {
    const progress = (await readProgress(view)) ?? { heartbeatAt: since.toISOString() };
    await writeJson(view.paths.progress, change(progress));
  };
  // A beat that could not be written leaves the last one: the check goes on, said by its result.
  await write(progress => ({ ...progress, heartbeatAt: now().toISOString(), checking: since.toISOString() })).catch(
    () => undefined
  );
  const timer = setInterval(() => {
    write(progress => ({ ...progress, heartbeatAt: now().toISOString() })).catch(() => undefined);
  }, KEEP_ALIVE_MS);
  try {
    return await work();
  } finally {
    clearInterval(timer);
    await write(({ checking, ...progress }) => ({
      ...progress,
      heartbeatAt: now().toISOString(),
      // Counted from its own start, whatever another writer kept: two checks at once are not counted twice.
      checkedMs: (progress.checkedMs ?? 0) + (checking === since.toISOString() ? now().getTime() - since.getTime() : 0)
    })).catch(() => undefined);
  }
};

/** The time a task's agent has worked on it: since it was taken, less what the CLI's checks held it for. */
export const workedMs = (takenAt: string, progress: TaskProgress | undefined, now: Date): number => {
  const holding = progress?.checking === undefined ? 0 : now.getTime() - Date.parse(progress.checking);

  return Math.max(0, now.getTime() - Date.parse(takenAt) - (progress?.checkedMs ?? 0) - Math.max(0, holding));
};
