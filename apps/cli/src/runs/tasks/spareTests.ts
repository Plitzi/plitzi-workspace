import { DEVELOPER, readTeam, startedAgents, TESTER } from '../team';
import { testWriters, writesTests } from '../tests';

import type { RunTask } from '../model';
import type { LoadedRun } from '../run';
import type { TaskView } from '../taskStore';

/**
 * A task of tests a tester writes: one no developer of the team may — each worked what it tests (a team of one
 * developer). The tests are a developer's work, the tester's Opus its reviews (Carlos); written by whoever wrote the work,
 * they would test its code, not what was asked.
 */
export const spareTests = async (
  loaded: LoadedRun,
  views: readonly TaskView[],
  agent: string
): Promise<(task: RunTask) => boolean> => {
  const team = await readTeam(loaded.paths.root).catch(() => undefined);
  const started = team ? startedAgents(team) : [];
  if (!started.some(each => each.agent === agent && each.roles.includes(TESTER))) {
    return () => false;
  }

  const developers = started
    .filter(each => each.roles.includes(DEVELOPER) && !each.roles.includes(TESTER))
    .map(each => each.agent);

  return task =>
    task.testsOf !== undefined && writesTests(task, agent, views) && testWriters(task, views, developers).length === 0;
};
