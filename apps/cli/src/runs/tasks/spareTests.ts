import { testersOf } from '../leads';
import { readRunLog } from '../run';
import { DEVELOPER, readTeam, startedAgents, TESTER } from '../team';
import { TESTS_SUFFIX } from '../tests';
import { isWorked } from '../worked';
import { roleOf } from './common';

import type { RunTask } from '../model';
import type { LoadedRun } from '../run';
import type { TaskView } from '../taskStore';

/**
 * A tests card (`<task>-tests`) a developer may take while every tester of the team is at a task of its own: a run's
 * one tester was at work 104 of its 152 minutes, the last 45 its cards alone, three developers waiting. Never one who
 * worked a task it tests — tests are written from what was asked, by someone who did not write the work.
 */
export const spareTests = async (
  loaded: LoadedRun,
  views: readonly TaskView[],
  agent: string
): Promise<(task: RunTask) => boolean> => {
  const team = await readTeam(loaded.paths.root).catch(() => undefined);
  const developer = (team ? startedAgents(team) : []).some(
    each => each.agent === agent && each.roles.includes(DEVELOPER)
  );
  const testers = await testersOf(loaded.paths.root);
  const atWork = (who: string): boolean => views.some(view => view.owner?.agent === who && isWorked(view.state.status));
  if (!developer || testers.length === 0 || !testers.every(atWork)) {
    return () => false;
  }

  const worked = new Set(
    (await readRunLog(loaded.paths)).flatMap(entry =>
      entry.action === 'take' && entry.by === agent && typeof entry.task === 'string' ? [entry.task] : []
    )
  );

  return task =>
    roleOf(task) === TESTER && task.id.includes(TESTS_SUFFIX) && !task.dependsOn.some(each => worked.has(each));
};
