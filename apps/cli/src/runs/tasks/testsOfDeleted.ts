import { writeJson } from '../../core/files';
import { taskPaths } from '../../core/paths';
import { viewTask } from '../../core/taskStore';
import { logRun, readApproved } from '../run';
import { LEAD, sendMessage } from '../talk/messages';

import type { Acceptance } from '../../core/model';
import type { LoadedRun, RunContext } from '../run';

/**
 * A task's tests card made by the run (`withTestTasks`) names the test files of what the task writes — and a task that
 * removes a module removes its tests: a run's t-shell deleted the starter's StatCard plugin, and t-shell-tests was left
 * holding `src/plugins/StatCard/*.test.ts` and a line running them. Once the task is approved, a tests card not taken yet
 * gives up the files it deleted and the lines that run only them, said to the lead.
 */

/** Whether a check runs one of `gone` — by its path, or by a glob over a folder only gone files were in. */
export const runsOnly = (check: string, gone: readonly string[], kept: readonly string[]): boolean =>
  check.split(/\s+/).some(word => {
    const glob = word.indexOf('*');
    const base = glob === -1 ? word : word.slice(0, glob);

    return (
      base !== '' &&
      gone.some(file => (glob === -1 ? file === word : file.startsWith(base))) &&
      !kept.some(file => (glob === -1 ? file === word : file.startsWith(base)))
    );
  });

export const trimTestsOfDeleted = async (
  ctx: RunContext,
  loaded: LoadedRun,
  approvedTask: string
): Promise<string[]> => {
  const approved = (await readApproved(loaded.paths)).files;
  const trimmed: string[] = [];
  for (const task of loaded.tasks.filter(each => each.testsOf?.includes(approvedTask) === true)) {
    const status = (await viewTask(loaded.paths, task)).state.status;
    const gone = task.files.filter(file => {
      const entry = Object.hasOwn(approved, file) ? approved[file] : undefined;

      return entry?.task === approvedTask && entry.digest === null;
    });
    if ((status !== 'pending' && status !== 'ready') || gone.length === 0) {
      continue;
    }

    const files = task.files.filter(file => !gone.includes(file));
    const acceptance = task.acceptance.filter(
      (line: Acceptance) => typeof line === 'string' || !runsOnly(line.check, gone, files)
    );
    await writeJson(taskPaths(loaded.paths, task.id).definition, { ...task, files, acceptance });
    await logRun(ctx, loaded.paths, { action: 'tests-trimmed', task: task.id, of: approvedTask, gone });
    await sendMessage(ctx, loaded, {
      from: approvedTask,
      to: LEAD,
      fyi: true,
      text: `${approvedTask} removed ${gone.join(', ')}: ${task.id}, not taken yet, holds ${gone.length === 1 ? 'it' : 'them'} no more, nor the lines that ran only ${gone.length === 1 ? 'it' : 'them'}${files.length === 0 ? ` — it holds no file now: narrow it or take it out (plitzi run amend)` : ''}`
    });
    trimmed.push(task.id);
  }

  return trimmed;
};
