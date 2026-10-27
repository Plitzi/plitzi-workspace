import { isRecord } from '@plitzi/sdk-shared/helpers';

import { readJson, writeJson } from '../core/files';

import type { TaskView } from '../core/taskStore';

/** How often a long check gives its task's sign of life: well inside what reads "no signal". */
export const KEEP_ALIVE_MS = 60_000;

/**
 * Runs `work` — a task's checks, its acceptance's commands — giving the task's sign of life while it runs: an agent
 * inside one long command can give none, and its live task read "no signal — reassign it" (a run's dev-1 in a whole
 * suite pass).
 */
export const keepAlive = async <T>(view: TaskView, now: () => Date, work: () => Promise<T>): Promise<T> => {
  const beat = async (): Promise<void> => {
    const progress: unknown = await readJson(view.paths.progress, isRecord, 'its progress').catch(() => undefined);
    await writeJson(view.paths.progress, { ...(isRecord(progress) ? progress : {}), heartbeatAt: now().toISOString() });
  };
  const timer = setInterval(() => {
    // A beat that could not be written leaves the last one: the check goes on, said by its result.
    beat().catch(() => undefined);
  }, KEEP_ALIVE_MS);
  try {
    return await work();
  } finally {
    clearInterval(timer);
  }
};
