import { writeJson } from './files';
import { EVERYONE, LEAD, sendMessage } from './messages';
import { acceptanceText } from './model';
import { taskPaths } from './paths';
import { acceptanceProblems } from './plan';
import { RunRefusal } from './refusal';
import { assertStatus, loadRun, logRun, readPlanFile, requireNoTask } from './run';
import { viewTask } from './taskStore';

import type { PlannedTask, RunPlan, RunTask } from './model';
import type { RunContext } from './run';

/**
 * `plitzi run amend`: the lead corrects what a plan asks while the run is open — a task's title, acceptance, priority
 * or estimate, the goal, a note more — from the plan file edited. What makes the run's shape — which tasks there are,
 * their files, what they wait for, their role, what they touch — stays as the run opened it: that is a new plan. A task
 * done is not asked again. Each task whose ask changed is told so, with what it now says; nothing is changed unsaid.
 */

export interface AmendedTask {
  task: string;
  /** The fields that changed, by name. */
  changed: string[];
}

export interface Amended {
  runId: string;
  tasks: AmendedTask[];
  /** The plan's notes that are new, sent to every task. */
  notes: string[];
  goal?: string;
}

const SHAPE = ['files', 'dependsOn', 'role', 'touches'] as const;
const ASK = ['title', 'acceptance', 'priority', 'estimateMinutes', 'milestone'] as const;

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export const amendRun = async (ctx: RunContext, runId: string, file: string): Promise<Amended> => {
  requireNoTask(ctx, 'amend the plan');
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'amend the plan');
  const next: RunPlan = await readPlanFile(file);
  if (next.runId !== runId) {
    throw new RunRefusal('invalid', `${file} is the plan of "${next.runId}", not of run "${runId}"`);
  }

  const before = new Map(loaded.plan.tasks.map(task => [task.id, task]));
  const problems: string[] = [];
  const added = next.tasks.filter(task => !before.has(task.id)).map(task => task.id);
  const removed = loaded.plan.tasks.filter(task => !next.tasks.some(each => each.id === task.id)).map(task => task.id);
  if (added.length > 0 || removed.length > 0) {
    problems.push(
      `The run's tasks are the ones it opened with: ${[...added.map(id => `"${id}" added`), ...removed.map(id => `"${id}" removed`)].join(', ')}`
    );
  }

  const changes: { task: PlannedTask; defined: RunTask; changed: string[] }[] = [];
  for (const task of next.tasks) {
    const was = before.get(task.id);
    const defined = loaded.tasks.find(each => each.id === task.id);
    if (!was || !defined) {
      continue;
    }

    const shape = SHAPE.filter(field => !same(task[field], was[field]));
    if (shape.length > 0) {
      problems.push(`Task "${task.id}": its ${shape.join(', ')} make the run's shape — that is a new plan`);
    }

    const changed = ASK.filter(field => !same(task[field], was[field]));
    if (changed.length === 0) {
      continue;
    }

    if ((await viewTask(loaded.paths, defined)).state.status === 'done') {
      problems.push(`Task "${task.id}" is done: what it was asked was held already`);
      continue;
    }

    problems.push(...(await acceptanceProblems(ctx.root, task)));
    changes.push({ task, defined, changed: [...changed] });
  }

  if (problems.length > 0) {
    throw new RunRefusal(
      'invalid',
      `The plan is not amended:\n${problems.map(problem => `  - ${problem}`).join('\n')}`,
      {
        problems
      }
    );
  }

  const knownNotes = new Set(loaded.plan.notes ?? []);
  const notes = (next.notes ?? []).filter(note => !knownNotes.has(note));
  const goal = next.goal === loaded.plan.goal ? undefined : next.goal;
  if (changes.length === 0 && notes.length === 0 && goal === undefined) {
    throw new RunRefusal('invalid', `${file} asks nothing the run does not already: no task, note or goal changed`);
  }

  for (const { task, defined } of changes) {
    const amended: RunTask = {
      ...defined,
      title: task.title,
      acceptance: task.acceptance,
      priority: task.priority,
      estimateMinutes: task.estimateMinutes,
      ...(task.milestone === undefined ? {} : { milestone: task.milestone })
    };
    if (task.milestone === undefined) {
      delete amended.milestone;
    }

    await writeJson(taskPaths(loaded.paths, task.id).definition, amended);
  }

  // What the run was opened with is kept as the plan, amended: the plan the report and `run status` read.
  await writeJson(loaded.paths.plan, next);
  for (const { task, changed } of changes) {
    await sendMessage(ctx, loaded, {
      from: LEAD,
      to: task.id,
      text: `The lead amended this task (${changed.join(', ')}). It now asks: ${task.title}${
        changed.includes('acceptance') ? ` — ${task.acceptance.map(each => acceptanceText(each)).join('; ')}` : ''
      }. Read it again: plitzi task context`
    });
  }

  for (const note of notes) {
    await sendMessage(ctx, loaded, { from: LEAD, to: EVERYONE, text: note });
  }

  const amended: Amended = {
    runId,
    tasks: changes.map(({ task, changed }) => ({ task: task.id, changed })),
    notes,
    ...(goal === undefined ? {} : { goal })
  };
  await logRun(ctx, loaded.paths, { action: 'amend', ...amended });

  return amended;
};
