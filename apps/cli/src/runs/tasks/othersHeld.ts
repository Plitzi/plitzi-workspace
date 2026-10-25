import { checkAcceptance } from '../acceptance';
import { acceptancePages, pageFits, pagesOf } from '../pagesOf';
import { viewTask } from '../taskStore';

import type { Serving } from '../acceptance';
import type { AcceptanceResult } from '../model';
import type { LoadedRun } from '../run';

/** A line of an approved task, run again on a task's copy: whose it is, what it says, and what it answered there. */
export type OtherLine = AcceptanceResult & { task: string };

/**
 * The lines approved tasks were accepted on that check a page the task's files draw — run again on its copy, before it
 * goes to review. A task that moves another's page on purpose (a run's stats became a panel, the retro rewrote
 * `/design`'s copy) broke their lines, and nothing said so until the finish, three of them at once: said here, to the
 * one who can fix it — or, when the change is meant, say so and the lead amends the line.
 */
export const othersHeld = async (
  loaded: LoadedRun,
  taskId: string,
  changed: readonly string[],
  where: { work: string; root: string; cache: string; serving?: Serving }
): Promise<OtherLine[]> => {
  const drawn = await pagesOf(where.work, changed);
  if (drawn.length === 0) {
    return [];
  }

  const lines = (
    await Promise.all(
      loaded.tasks
        .filter(each => each.id !== taskId)
        .map(async each => {
          const { state } = await viewTask(loaded.paths, each);

          return state.status === 'done'
            ? (state.accepted ?? [])
                .filter(
                  line => line.ok && acceptancePages([line]).some(page => drawn.some(route => pageFits(route, page)))
                )
                .map(line => ({ task: each.id, said: line.said, check: line.check }))
            : [];
        })
    )
  ).flat();
  if (lines.length === 0) {
    return [];
  }

  const answered = await checkAcceptance(
    lines.map(({ said, check }) => ({ said, check })),
    where
  );

  return answered.map((result, index) => ({ ...result, task: lines[index].task }));
};
