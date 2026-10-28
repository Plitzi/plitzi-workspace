import { findTask } from './common';
import { reassignTask } from './reassign';
import { requireLead } from '../agents/leads';
import { RunRefusal } from '../core/refusal';
import { updateState, viewTask } from '../core/taskStore';
import { assertStatus, loadRun, logRun, requireNoTask } from '../run';

import type { RunTask } from '../core/model';
import type { RunContext } from '../run';

/** The tasks that wait on `taskId`, however far down: what cannot be done without it. */
const waitingOn = (tasks: readonly RunTask[], taskId: string): string[] => {
  const found = new Set<string>();
  const visit = (id: string): void => {
    for (const task of tasks.filter(each => each.dependsOn.includes(id) || (each.testsOf ?? []).includes(id))) {
      if (!found.has(task.id)) {
        found.add(task.id);
        visit(task.id);
      }
    }
  };
  visit(taskId);

  return [...found];
};

/**
 * `plitzi task leave <task> --why "…"`: the lead takes a task out of the open run — and those that wait on it, which
 * cannot be done without it. Whoever holds one is cut, its files let go; no one takes them again, and the finish writes
 * the run without them, said in its report. A run's task found to be the platform's took a stop, an unblock, a
 * reassign and `--leave-pending` to leave out, its agent working on in between.
 */
export const leaveTask = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  why: string
): Promise<{ left: string[]; cut: string[] }> => {
  requireNoTask(ctx, 'leave a task out');
  const loaded = await loadRun(ctx, runId);
  await requireLead(ctx, 'leave a task out');
  assertStatus(loaded, ['open', 'stopping'], 'leave a task out');
  if (why.trim() === '') {
    throw new RunRefusal('invalid', `Say why it is left out: plitzi task leave ${taskId} --why "…"`);
  }

  const task = findTask(loaded, taskId);
  const views = await Promise.all(
    [task, ...waitingOn(loaded.tasks, taskId).map(id => findTask(loaded, id))].map(each => viewTask(loaded.paths, each))
  );
  const [own] = views;
  if (own.state.status === 'done') {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}" is done: take its work back instead (plitzi task revert ${taskId})`
    );
  }

  if (own.state.status === 'left') {
    throw new RunRefusal('invalid', `Task "${taskId}" is left out already: ${own.state.left?.why ?? ''}`);
  }

  // A task that waits on it and is done stays: what it wrote is the run's, whatever this one was to add.
  const leaving = views.filter(view => view.state.status !== 'done' && view.state.status !== 'left');
  const cut: string[] = [];
  for (const view of leaving.filter(each => each.owner !== undefined)) {
    await reassignTask(ctx, runId, view.task.id, { reason: `left out of the run: ${why}` });
    cut.push(view.task.id);
  }

  const at = ctx.now().toISOString();
  for (const view of leaving) {
    await updateState(
      view.paths,
      state => ({
        ...state,
        status: 'left',
        blockedBy: undefined,
        left: { why: view.task.id === taskId ? why : `it waits on ${taskId}, left out: ${why}`, by: ctx.agent, at }
      }),
      ctx.now
    );
  }

  const left = leaving.map(view => view.task.id);
  await logRun(ctx, loaded.paths, { action: 'leave', task: taskId, why, left, cut });

  return { left, cut };
};
