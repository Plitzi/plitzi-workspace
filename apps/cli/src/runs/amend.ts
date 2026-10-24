import fs from 'node:fs/promises';

import { acceptanceProblems } from './acceptanceProblems';
import { readOptional, writeAtomic, writeJson } from './files';
import { coversOf, inventoryProblems } from './inventory';
import { requireLead } from './leads';
import { EVERYONE, LEAD, sendMessage } from './messages';
import { acceptanceText } from './model';
import { taskPaths } from './paths';
import { RunRefusal } from './refusal';
import {
  assertStatus,
  handedInputs,
  loadRun,
  logRun,
  primerFile,
  readPlanFile,
  readPrimer,
  readRunLog,
  requireNoTask,
  updateRecord,
  withInputs
} from './run';
import { PLAN_FINDING } from './spike';
import { withLock } from './store';
import { updateState, viewTask } from './taskStore';
import { TESTER } from './team';
import { TESTS_SUFFIX } from './tests';

import type { PlannedTask, RunPlan, RunTask } from './model';
import type { LoadedRun, RunContext } from './run';
import type { Finding } from './spike';

/** What keeps `task`'s new dependencies from holding: one the run has not, itself, or a circle back to it. */
const dependsOnProblems = (task: PlannedTask, inRun: readonly RunTask[], planned: readonly PlannedTask[]): string[] => {
  const ids = new Set(inRun.map(each => each.id));
  const unknown = task.dependsOn.filter(id => !ids.has(id) || id === task.id);
  if (unknown.length > 0) {
    return [
      `Task "${task.id}" would wait for ${unknown.map(id => `"${id}"`).join(', ')}: a task of the run, not itself`
    ];
  }

  const waitsFor = new Map(inRun.map(each => [each.id, each.dependsOn] as const));
  planned.forEach(each => waitsFor.set(each.id, each.dependsOn));
  const reaches = (from: string, seen: Set<string>): boolean =>
    (waitsFor.get(from) ?? []).some(id => id === task.id || (!seen.has(id) && reaches(id, seen.add(id))));

  return reaches(task.id, new Set()) ? [`Task "${task.id}" would wait for itself, through what it waits for`] : [];
};

/**
 * `plitzi run amend`: the lead corrects what a plan asks while the run is open — a task's title, acceptance, priority
 * or estimate, the goal, a note more — from the plan file edited. What makes the run's shape — which tasks there are,
 * their files, what they touch — stays as the run opened it, but for a task nobody took, which may
 * leave it (less to do; its pieces of the inventory then wait, or another task covers them) — a task more is a stage
 * (`run extend`). Who a task is for
 * — its role and quality — and what it waits for change until an agent takes it, and not after: it was taken as that. A task done is not
 * asked again — but for its acceptance, which the finish runs again on the whole result: a line of the lead's found wrong
 * is amended there too. Each task whose ask changed is told so, with what it now says; nothing is changed unsaid.
 *
 * A run with stages stacked on it (`run extend`) is amended from any of its plans — the one it opened with, a stage's as it
 * was stacked, or several joined — each speaking for the plans whose tasks it holds: a task leaves the run only when a plan
 * that holds its fellows leaves it out, and the run's goal stays the run's unless the plan it opened with is amended.
 */

export interface AmendedTask {
  task: string;
  /** The fields that changed, by name. */
  changed: string[];
  /** Done already: its acceptance amended, held again at the finish — nobody told, as nobody is at it. */
  done?: true;
}

export interface Amended {
  runId: string;
  tasks: AmendedTask[];
  /** The plan's notes that are new, sent to every task. */
  notes: string[];
  goal?: string;
  /** The plan's primer changed: written again, and every task told. */
  primer?: true;
  /** Tasks nobody had taken, gone from the run: less to do, as the plan now says. */
  removed?: string[];
  /** The site the run copies, as the plan now says it: what `run reference` keeps. */
  reference?: string;
  /** The inventory changed: what the plan covers, and what it says waits. */
  inventory?: true;
}

const SHAPE = ['files', 'touches'] as const;
const ASK = ['title', 'acceptance', 'priority', 'estimateMinutes', 'milestone', 'findings'] as const;
/** The finding a plan gives a task, as its state keeps it beside what its spikes found (`startingState`). */
const isPlanFinding = (finding: Finding): boolean => finding.by === LEAD && finding.question === PLAN_FINDING;
// What a task waits for, and who it is for, change until it is taken: a lead clears a bottleneck by letting one start
// sooner (velada-now: t-motion waited for t-boxer's third round, though it shared no file with it).
const WHO = ['role', 'quality', 'dependsOn'] as const;
// A spike nobody holds is untaken too: a lead finds it out, and no agent has taken it as anything yet.
const UNTAKEN: readonly string[] = ['pending', 'ready', 'spike'];

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The plan a task came in with: 0 for the one the run opened with, n for the n-th stage stacked on it. */
const OPENED = 0;

/**
 * Where each task of the run came from, read off its log — whatever each plan called itself: lx-product's stages said
 * the run's own id, and its amend read a stage's plan as the run's and refused to drop s-scope. A task stacked again
 * after it left (`run extend` once more) is its last stage's.
 */
const originsOf = async (loaded: LoadedRun): Promise<(id: string) => number> => {
  const origins = new Map<string, number>();
  const stacked = (await readRunLog(loaded.paths)).filter(entry => entry.action === 'extend');
  stacked.forEach((entry, index) => {
    const added: unknown = entry.added;
    for (const id of Array.isArray(added) ? added : []) {
      if (typeof id === 'string') {
        origins.set(id, index + 1);
      }
    }
  });

  return id => origins.get(id) ?? OPENED;
};

/** The run's tasks as a stage's plan amends them: each it holds as it says, those it left out gone. */
/**
 * A task the run made from the plan rather than one the plan wrote — the tests of its developer tasks (`withTestTasks`):
 * it stays while every task it was made after does. encore-2's amend of a stage dropped three of them, as "nobody had
 * taken them", with the proposals sent to them.
 */
const derivedFrom = (task: RunTask, next: RunPlan): boolean =>
  task.role === TESTER &&
  new RegExp(`${TESTS_SUFFIX}(-\\d+)?$`).test(task.id) &&
  task.dependsOn.length > 0 &&
  task.dependsOn.every(id => next.tasks.some(each => each.id === id));

const amendedTasks = (plan: RunPlan, next: RunPlan, removed: readonly RunTask[]): PlannedTask[] =>
  plan.tasks
    .filter(task => !removed.some(each => each.id === task.id))
    .map(task => next.tasks.find(each => each.id === task.id) ?? task);

export const amendRun = async (ctx: RunContext, runId: string, file: string): Promise<Amended> => {
  requireNoTask(ctx, 'amend the plan');
  const loaded = await loadRun(ctx, runId);
  await requireLead(ctx, loaded, 'amend the plan');
  assertStatus(loaded, ['open', 'stopping'], 'amend the plan');
  const next: RunPlan = await readPlanFile(file);
  const before = new Map(loaded.plan.tasks.map(task => [task.id, task]));
  if (!next.tasks.some(task => before.has(task.id))) {
    throw new RunRefusal(
      'invalid',
      `${file} holds none of run "${runId}"'s tasks: it is neither the plan the run opened with nor a stage stacked on it`
    );
  }

  // The plans this one speaks for: those whose tasks it holds. One that leaves out the plan the run opened with — a
  // stage's — keeps the run's goal, inventory and reference as they are.
  const originOf = await originsOf(loaded);
  const spoken = new Set(next.tasks.filter(task => before.has(task.id)).map(task => originOf(task.id)));
  const stage = !spoken.has(OPENED);
  // A plan it does not speak for keeps its tasks and the pieces they prove: a plan joined by hand without a stage
  // stacked minutes before dropped that stage's task (lx-product's t-gallery-phone).
  const untold = loaded.plan.tasks.filter(task => !spoken.has(originOf(task.id)));
  const untoldPieces = (loaded.plan.inventory ?? []).filter(
    piece =>
      !(next.inventory ?? []).some(each => each.id === piece.id) &&
      untold.some(task => task.acceptance.some(line => coversOf(line).includes(piece.id)))
  );
  const whole: RunPlan = stage
    ? next
    : {
        ...next,
        tasks: [...next.tasks, ...untold.filter(task => !next.tasks.some(each => each.id === task.id))],
        ...(next.inventory || untoldPieces.length > 0
          ? { inventory: [...(next.inventory ?? []), ...untoldPieces] }
          : {})
      };

  const problems: string[] = [];
  const added = next.tasks.filter(task => !before.has(task.id)).map(task => task.id);
  if (added.length > 0) {
    problems.push(
      `${added.map(id => `"${id}"`).join(', ')} the run does not have: a task more is a stage stacked on it — plitzi run extend ${runId} <its plan>`
    );
  }

  // Less to do: a task nobody took goes — left out by a plan that speaks for it — and what it covered is said waiting, or
  // covered by another.
  const removed = loaded.tasks.filter(
    task =>
      task.kind === 'work' &&
      spoken.has(originOf(task.id)) &&
      !next.tasks.some(each => each.id === task.id) &&
      !derivedFrom(task, next)
  );
  for (const task of removed) {
    const view = await viewTask(loaded.paths, task);
    if (!UNTAKEN.includes(view.state.status) || view.owner || view.state.round > 0) {
      problems.push(
        `Task "${task.id}" is ${view.state.status}${view.owner ? `, ${view.owner.agent}'s` : ''}: only a task nobody took leaves the run — cut it first (plitzi task reassign ${task.id}), or keep it`
      );
    }

    const waiting = whole.tasks.filter(each => each.dependsOn.includes(task.id)).map(each => each.id);
    if (waiting.length > 0) {
      problems.push(
        `Task "${task.id}" is what ${waiting.map(id => `"${id}"`).join(', ')} ${waiting.length === 1 ? 'waits' : 'wait'} for: remove them too, or keep it`
      );
    }
  }

  const inventoryChanged = !stage && !same(whole.inventory, loaded.plan.inventory);
  if (inventoryChanged || removed.length > 0) {
    problems.push(
      ...inventoryProblems(stage ? { ...loaded.plan, tasks: amendedTasks(loaded.plan, next, removed) } : whole)
    );
  }

  const changes: { task: PlannedTask; defined: RunTask; changed: string[]; done?: true }[] = [];
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

    const viewed = await viewTask(loaded.paths, defined);
    const { status } = viewed.state;
    if (status === 'done') {
      // Done is held at the finish by its acceptance alone, run again on the whole result: a line of the lead's found
      // wrong there is amended — lx-product's page-weight bound, too tight once other tasks reached every page, held the
      // finish with no way to change it. What else it was asked was held already.
      const held = changed.filter(field => field !== 'acceptance');
      if (held.length > 0) {
        problems.push(
          `Task "${task.id}" is done: its ${held.join(' and ')} ${held.length === 1 ? 'was' : 'were'} held already — only its acceptance, which the finish runs again, is amended`
        );
        continue;
      }

      problems.push(...(await acceptanceProblems(ctx.root, task)));
      changes.push({ task, defined, changed: [...changed], done: true });
      continue;
    }

    if (who.length > 0 && (!UNTAKEN.includes(status) || viewed.owner !== undefined)) {
      problems.push(
        `Task "${task.id}" is ${status}: its ${who.join(' and ')} are what an agent took it as — they change only before it is taken`
      );
      continue;
    }

    if (!same(task.dependsOn, was.dependsOn)) {
      problems.push(...dependsOnProblems(task, loaded.tasks, next.tasks));
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
  // The site the run copies, set or changed: a run opened on its scope alone has none until the lead names it
  // (velada-polish: `run reference` refused, and the amend said nothing changed).
  const reference = !stage && next.reference !== loaded.plan.reference ? next.reference : undefined;
  if (
    changes.length === 0 &&
    notes.length === 0 &&
    goal === undefined &&
    !primerChanged &&
    removed.length === 0 &&
    !inventoryChanged &&
    reference === undefined
  ) {
    throw new RunRefusal(
      'invalid',
      `${file} asks nothing the run does not already: no task, note, goal, primer, inventory or reference changed`
    );
  }

  for (const { task, defined, done } of changes) {
    // What the plan leaves out is dropped, not kept from before: the definition is the plan's, as amended.
    const { milestone: _milestone, role: _role, quality: _quality, findings: _findings, ...kept } = defined;
    const amended: RunTask = {
      ...kept,
      title: task.title,
      acceptance: task.acceptance,
      priority: task.priority,
      estimateMinutes: task.estimateMinutes,
      dependsOn: task.dependsOn,
      ...(task.role === undefined ? {} : { role: task.role }),
      ...(task.quality === undefined ? {} : { quality: task.quality }),
      ...(task.milestone === undefined ? {} : { milestone: task.milestone }),
      ...(task.findings === undefined ? {} : { findings: task.findings })
    };

    await writeJson(taskPaths(loaded.paths, task.id).definition, amended);
    // What the finish holds a task to is what its review accepted: the amended lines take their place there — one
    // unchanged keeps what it answered, a new one waits for the finish to run it. A task in review is held to them too:
    // encore-2's t-playback-safety, amended while in review, was approved on its old line and the finish refused it.
    await updateState(
      taskPaths(loaded.paths, task.id),
      state =>
        state.accepted === undefined && !done
          ? state
          : {
              ...state,
              accepted: task.acceptance.flatMap(line =>
                typeof line === 'string'
                  ? []
                  : [
                      (state.accepted ?? []).find(each => each.said === line.said && each.check === line.check) ?? {
                        said: line.said,
                        check: line.check,
                        ok: false,
                        amended: ctx.now().toISOString()
                      }
                    ]
              )
            },
      ctx.now
    );
    // A finding gone wrong was corrected only by a message (lx-copy's "write every stub"): the brief says the new one.
    if (!same(task.findings, before.get(task.id)?.findings)) {
      const planned = task.findings;
      await updateState(
        taskPaths(loaded.paths, task.id),
        state => ({
          ...state,
          findings: [
            ...(planned === undefined
              ? []
              : [{ at: ctx.now().toISOString(), by: LEAD, question: PLAN_FINDING, text: planned }]),
            ...(state.findings ?? []).filter(finding => !isPlanFinding(finding))
          ]
        }),
        ctx.now
      );
    }
  }

  // Under the take's lock, and looked at again there: an agent that took one meanwhile keeps it, and nothing is removed.
  if (removed.length > 0) {
    await withLock(
      loaded.paths.takeLock,
      async () => {
        for (const task of removed) {
          const view = await viewTask(loaded.paths, task);
          if (!UNTAKEN.includes(view.state.status) || view.owner) {
            throw new RunRefusal(
              'invalid',
              `Task "${task.id}" was taken meanwhile (${view.state.status}): the plan is not amended — keep it, or cut it first`
            );
          }
        }

        for (const task of removed) {
          await fs.rm(taskPaths(loaded.paths, task.id).dir, { recursive: true, force: true });
        }
      },
      { now: ctx.now }
    );
    await updateRecord(ctx, loaded.paths, record => ({
      ...record,
      estimate: {
        ...record.estimate,
        tasks: record.estimate.tasks - removed.length,
        totalMinutes: record.estimate.totalMinutes - removed.reduce((sum, task) => sum + task.estimateMinutes, 0)
      }
    }));
  }

  // What the run was opened with is kept as the plan, amended: the plan the report and `run status` read. A stage's
  // tasks take their place in it; the rest of the run's plan stays.
  await writeJson(
    loaded.paths.plan,
    stage
      ? {
          ...loaded.plan,
          tasks: amendedTasks(loaded.plan, next, removed),
          notes: [...(loaded.plan.notes ?? []), ...notes]
        }
      : { ...whole, ...(loaded.plan.primer && next.primer === undefined ? { primer: loaded.plan.primer } : {}) }
  );
  // A done task has nobody at it: what it now holds is said in the amend's answer and log, and held at the finish.
  for (const { task, changed } of changes.filter(change => change.done !== true)) {
    await sendMessage(ctx, loaded, {
      from: LEAD,
      to: task.id,
      text: `The lead amended this task (${changed.join(', ')}). It now asks: ${task.title}${
        changed.includes('acceptance') ? ` — ${task.acceptance.map(each => acceptanceText(each)).join('; ')}` : ''
      }${changed.includes('findings') ? `. What was found for it now says: ${task.findings ?? 'nothing'}` : ''}. Read it again: plitzi task context`
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
    tasks: changes.map(({ task, changed, done }) => ({ task: task.id, changed, ...(done ? { done } : {}) })),
    notes,
    ...(goal === undefined ? {} : { goal }),
    ...(primerChanged ? { primer: true as const } : {}),
    ...(removed.length > 0 ? { removed: removed.map(task => task.id) } : {}),
    ...(inventoryChanged ? { inventory: true as const } : {}),
    ...(reference === undefined ? {} : { reference })
  };
  await logRun(ctx, loaded.paths, { action: 'amend', ...amended });
  // The amendment and its primer are the run's now: removed with it, as the plan it opened with.
  const handed = await handedInputs(ctx, [file, primerFile(next, file)]);
  await updateRecord(ctx, loaded.paths, record => ({ ...record, inputs: withInputs(record.inputs, handed) }));

  return amended;
};
