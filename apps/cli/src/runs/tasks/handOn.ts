import { taskPaths } from '../core/paths';
import { updateState, viewTask } from '../core/taskStore';
import { dependenciesDone } from '../plan/plan';
import { loadRun, logRun } from '../run';

import type { TaskState } from '../core/model';
import type { LoadedRun, RunContext } from '../run';

/** The state of every task of the run, by id: what a hand-on reads its dependencies' off. */
export const statesOf = async (loaded: LoadedRun): Promise<Map<string, TaskState>> =>
  new Map(
    await Promise.all(loaded.tasks.map(async each => [each.id, (await viewTask(loaded.paths, each)).state] as const))
  );

/** Each pending task whose dependencies are all done now, made ready — by an approval, or a research's findings. */
export const readyWhatWaited = async (ctx: RunContext, loaded: LoadedRun): Promise<string[]> => {
  const states = await statesOf(loaded);
  const ready: string[] = [];
  for (const each of loaded.tasks) {
    if (states.get(each.id)?.status === 'pending' && dependenciesDone(each, states)) {
      await updateState(taskPaths(loaded.paths, each.id), state => ({ ...state, status: 'ready' }), ctx.now);
      ready.push(each.id);
    }
  }

  return ready;
};

/** Every task of the run done: the activity says the run is finished and what comes next. */
export const sayIfAllDone = async (ctx: RunContext, runId: string): Promise<void> => {
  const now = await loadRun(ctx, runId);
  const statuses = await Promise.all(now.tasks.map(async each => (await viewTask(now.paths, each)).state.status));
  if (statuses.length > 0 && statuses.every(status => status === 'done')) {
    await logRun(ctx, now.paths, {
      action: 'all-approved',
      tasks: now.tasks.length,
      next: 'plitzi run finish — the dry run checks the whole result; a person applies it'
    });
  }
};
