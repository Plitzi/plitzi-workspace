import { readOptional, writeAtomic, writeJson } from './files';
import { requireLead } from './leads';
import { EVERYONE, LEAD, sendMessage } from './messages';
import { acceptanceText } from './model';
import { taskPaths } from './paths';
import { acceptanceProblems } from './plan';
import { RunRefusal } from './refusal';
import {
  assertStatus,
  handedInputs,
  loadRun,
  logRun,
  primerFile,
  readPlanFile,
  readPrimer,
  requireNoTask,
  updateRecord,
  withInputs
} from './run';
import { viewTask } from './taskStore';

import type { PlannedTask, RunPlan, RunTask } from './model';
import type { RunContext } from './run';

/**
 * `plitzi run amend`: the lead corrects what a plan asks while the run is open — a task's title, acceptance, priority
 * or estimate, the goal, a note more — from the plan file edited. What makes the run's shape — which tasks there are,
 * their files, what they wait for, what they touch — stays as the run opened it: that is a new plan. Who a task is for
 * — its role and quality — changes until an agent takes it, and not after: it was taken as that. A task done is not
 * asked again. Each task whose ask changed is told so, with what it now says; nothing is changed unsaid.
 *
 * A run with stages stacked on it (`run extend`) is amended from either: its own plan, or a stage's as it was stacked —
 * the stage's tasks are the ones it changes, and the run's goal stays the run's.
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
  /** The plan's primer changed: written again, and every task told. */
  primer?: true;
}

const SHAPE = ['files', 'dependsOn', 'touches'] as const;
const ASK = ['title', 'acceptance', 'priority', 'estimateMinutes', 'milestone'] as const;
const WHO = ['role', 'quality'] as const;
const UNTAKEN: readonly string[] = ['pending', 'ready'];

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export const amendRun = async (ctx: RunContext, runId: string, file: string): Promise<Amended> => {
  requireNoTask(ctx, 'amend the plan');
  const loaded = await loadRun(ctx, runId);
  await requireLead(ctx, loaded, 'amend the plan');
  assertStatus(loaded, ['open', 'stopping'], 'amend the plan');
  const next: RunPlan = await readPlanFile(file);
  const before = new Map(loaded.plan.tasks.map(task => [task.id, task]));
  // A stage stacked on the run: its plan names its own tasks, all of them the run's.
  const stage = next.runId !== runId;
  if (stage && !next.tasks.some(task => before.has(task.id))) {
    throw new RunRefusal(
      'invalid',
      `${file} is the plan of "${next.runId}", and none of its tasks is run "${runId}"'s: it is no stage stacked on it`
    );
  }

  const problems: string[] = [];
  const added = next.tasks.filter(task => !before.has(task.id)).map(task => task.id);
  const removed = stage
    ? []
    : loaded.plan.tasks.filter(task => !next.tasks.some(each => each.id === task.id)).map(task => task.id);
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
      problems.push(`Task "${task.id}": its ${shape.join(' and ')} are the run's shape — that is a new plan`);
    }

    const who = WHO.filter(field => !same(task[field], was[field]));
    const changed = [...ASK.filter(field => !same(task[field], was[field])), ...who];
    if (changed.length === 0) {
      continue;
    }

    const { status } = (await viewTask(loaded.paths, defined)).state;
    if (status === 'done') {
      problems.push(`Task "${task.id}" is done: what it was asked was held already`);
      continue;
    }

    if (who.length > 0 && !UNTAKEN.includes(status)) {
      problems.push(
        `Task "${task.id}" is ${status}: its ${who.join(' and ')} are what an agent took it as — they change only before it is taken`
      );
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
  const goal = stage || next.goal === loaded.plan.goal ? undefined : next.goal;
  const primer = await readPrimer(next, file);
  const primerChanged = primer !== undefined && primer !== (await readOptional(loaded.paths.primer))?.toString('utf-8');
  if (changes.length === 0 && notes.length === 0 && goal === undefined && !primerChanged) {
    throw new RunRefusal('invalid', `${file} asks nothing the run does not already: no task, note or goal changed`);
  }

  for (const { task, defined } of changes) {
    // What the plan leaves out is dropped, not kept from before: the definition is the plan's, as amended.
    const { milestone: _milestone, role: _role, quality: _quality, ...kept } = defined;
    const amended: RunTask = {
      ...kept,
      title: task.title,
      acceptance: task.acceptance,
      priority: task.priority,
      estimateMinutes: task.estimateMinutes,
      ...(task.role === undefined ? {} : { role: task.role }),
      ...(task.quality === undefined ? {} : { quality: task.quality }),
      ...(task.milestone === undefined ? {} : { milestone: task.milestone })
    };

    await writeJson(taskPaths(loaded.paths, task.id).definition, amended);
  }

  // What the run was opened with is kept as the plan, amended: the plan the report and `run status` read. A stage's
  // tasks take their place in it; the rest of the run's plan stays.
  await writeJson(
    loaded.paths.plan,
    stage
      ? {
          ...loaded.plan,
          tasks: loaded.plan.tasks.map(task => next.tasks.find(each => each.id === task.id) ?? task),
          notes: [...(loaded.plan.notes ?? []), ...notes]
        }
      : { ...next, ...(loaded.plan.primer && next.primer === undefined ? { primer: loaded.plan.primer } : {}) }
  );
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

  if (primerChanged) {
    await writeAtomic(loaded.paths.primer, primer);
    await sendMessage(ctx, loaded, {
      from: LEAD,
      to: EVERYONE,
      text: 'The lead changed the run’s primer: read it again (plitzi task context)'
    });
  }

  const amended: Amended = {
    runId,
    tasks: changes.map(({ task, changed }) => ({ task: task.id, changed })),
    notes,
    ...(goal === undefined ? {} : { goal }),
    ...(primerChanged ? { primer: true as const } : {})
  };
  await logRun(ctx, loaded.paths, { action: 'amend', ...amended });
  // The amendment and its primer are the run's now: removed with it, as the plan it opened with.
  const handed = await handedInputs(ctx, [file, primerFile(next, file)]);
  await updateRecord(ctx, loaded.paths, record => ({ ...record, inputs: withInputs(record.inputs, handed) }));

  return amended;
};
