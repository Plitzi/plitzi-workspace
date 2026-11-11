import fs from 'node:fs/promises';

import { runGraph } from './runGraph';
import { stageImpact } from './stageImpact';
import { viewTask } from '../../core/taskStore';
import { materialise } from '../copies/materialise';
import { readApproved } from '../run';

import type { RunTaskNow } from './stageImpact';
import type { PlannedTask } from '../../core/model';
import type { TaskView } from '../../core/taskStore';
import type { LoadedRun, RunContext } from '../run';

/** The run's tasks as `stageImpact` weighs them: each where it stands, and who is at it. */
export const tasksNow = (views: readonly TaskView[]): RunTaskNow[] =>
  views.map(view => ({
    task: view.task,
    status: view.state.status,
    ...(view.owner ? { agent: view.owner.agent } : {})
  }));

/**
 * What `tasks` — an amendment's, asked something new — reach of the rest of the run, read off its approved work
 * materialised for the reading and removed after (`stageImpact`).
 */
export const impactOnRun = async (
  ctx: RunContext,
  loaded: LoadedRun,
  tasks: readonly Pick<PlannedTask, 'id' | 'files' | 'dependsOn' | 'testsOf'>[]
): Promise<string[]> => {
  if (tasks.length === 0) {
    return [];
  }

  const approved = (await readApproved(loaded.paths)).files;
  const work = await materialise(
    ctx,
    loaded,
    Object.fromEntries(Object.entries(approved).map(([file, each]) => [file, each.digest]))
  );
  try {
    const graph = await runGraph(loaded.paths.cache, work);
    const ids = new Set(tasks.map(task => task.id));
    const views = await Promise.all(
      loaded.tasks.filter(task => !ids.has(task.id)).map(task => viewTask(loaded.paths, task))
    );

    return stageImpact({ stage: tasks, run: tasksNow(views), importedBy: graph.importedBy, testsOf: graph.tests });
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }
};
