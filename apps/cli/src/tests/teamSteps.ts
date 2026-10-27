import { writeInCopy } from './runProject';
import { taskPaths } from '../runs/paths';
import { isRunRefusal } from '../runs/refusal';
import { loadRun } from '../runs/run';
import { completeTask, takeTask } from '../runs/tasks';
import { readState } from '../runs/taskStore';

import type { Bench } from './runProject';
import type { RunContext } from '../runs/run';

/** The steps a team's run is tested with: the lead, a developer's task in review, a task's design state, a refusal. */
export const teamSteps = (bench: () => Bench) => {
  const lead = (): RunContext => bench().agent('lead');

  const refusalOf = async (work: Promise<unknown>): Promise<string> => {
    const refused = await work.then(
      () => undefined,
      (error: unknown) => error
    );

    return isRunRefusal(refused) ? refused.message : 'not refused';
  };

  /** A developer takes a task, writes it and completes it: in review, as its agent leaves it. */
  const completed = async (name: string, taskId: string, file: string): Promise<void> => {
    const taken = await takeTask(bench().agent(name), 'es-launch', taskId);
    await writeInCopy(taken.work, file, `export const page = { title: '${taskId}' };\n`);
    await completeTask(bench().agent(name, { token: taken.token }), 'es-launch', taskId, {});
  };

  /** Where a card's review stands: its step, who took it. */
  const reviewOf = async (taskId: string) =>
    (await readState(taskPaths((await loadRun(lead(), 'es-launch')).paths, taskId))).review;

  return { lead, refusalOf, completed, reviewOf };
};
