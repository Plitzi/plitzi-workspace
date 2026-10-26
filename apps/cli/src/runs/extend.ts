import fs from 'node:fs/promises';
import path from 'node:path';

import { readJson, writeAtomic, writeJson } from './files';
import { coversOf } from './inventory';
import { requireLead, scoutsOf } from './leads';
import { materialise } from './materialise';
import { unmeasuredNotices } from './measuredValues';
import { EVERYONE, LEAD, sendMessage } from './messages';
import { isBaseManifest } from './model';
import { readOwnership } from './ownership';
import { taskPaths } from './paths';
import { checkPlan, PlanRefusal } from './plan';
import { RunRefusal } from './refusal';
import {
  assertStatus,
  handedInputs,
  loadRun,
  logRun,
  primerFile,
  readApproved,
  readPlanFile,
  readPrimer,
  requireNoTask,
  takeInputs,
  updateRecord,
  withInputs
} from './run';
import { isResearch, startingState } from './spike';
import { keepFiles } from './store';
import { viewTask } from './taskStore';
import { ensureTeam, teamSize } from './team';
import { tryLines } from './tryLines';

import type { RunPlan, RunTask } from './model';
import type { CheckedPlan } from './plan';
import type { RunContext } from './run';
import type { TriedLine } from './tryLines';

/**
 * `plitzi run extend`: the next plan stacked on an open run — begun where the run's work is, its tasks' copies made
 * with what the run approved, and written into the project with it, in one `finish`. A run done and waiting to be
 * applied is not the end of the work: the next stage goes on from it instead of waiting for a person, and the two are
 * one diff, one report, one apply. The new tasks may wait for the run's own (`dependsOn`); their files are backed up as
 * the run's were. What a task still at work holds is not the new plan's to name, nor is an id the run has.
 */

export interface Extended {
  runId: string;
  added: string[];
  ready: string[];
  notes: number;
  primer: boolean;
  /** The agents the run allows at once, when the stage raised them: what was asked, or the team's size. */
  agents?: { before: number; after: number };
  /** The stage's plan and primer, moved into the run's folder from the project: where the lead edits them now. */
  inputs?: string[];
  /** The run's pieces it had left out that the stage covers: no longer waiting, by id. */
  takenUp?: string[];
  /** `dryRun`: the stage as it would be stacked — its tasks with the CLI's, estimated — and nothing written. */
  checked?: CheckedPlan;
  /** What its check says and refuses nothing for: said when it is stacked too — a stage's said only by a dry run once. */
  notices?: string[];
  /** `dryRun` with `lines`: each acceptance line run once on the run's work, with what it is (`tryLines.ts`). */
  tried?: TriedLine[];
}

export const extendRun = async (
  ctx: RunContext,
  runId: string,
  file: string,
  { dryRun = false, lines = false }: { dryRun?: boolean; lines?: boolean } = {}
): Promise<Extended> => {
  requireNoTask(ctx, 'extend a run');
  const loaded = await loadRun(ctx, runId);
  // Seen before it is stacked by the scout that proposes it too: stacking it is the lead's.
  if (!(dryRun && (await scoutsOf(ctx.root)).includes(ctx.agent))) {
    await requireLead(ctx, 'stack a stage on the run');
  }

  assertStatus(loaded, ['open'], 'extend');
  // A stage names itself and says its goal, or takes the run's: what is new in it is its tasks. One that says the run's
  // own name is given a stage's — a run's three stages all said the run's own name, and were stacked under the run's name.
  const stageId = `${runId}-stage-${String(loaded.tasks.length)}`;
  const read: RunPlan = await readPlanFile(file, { runId: stageId, goal: loaded.plan.goal });
  const next: RunPlan = read.runId === runId ? { ...read, runId: stageId } : read;
  const { team } = await ensureTeam(ctx.root, next);
  // A stage worked by a larger team lets them work: never fewer than the run had.
  const allowed = Math.max(loaded.record.agents, teamSize(team));
  const known = new Set(loaded.tasks.map(task => task.id));
  const problems: string[] = [];
  const repeated = next.tasks.filter(task => known.has(task.id)).map(task => task.id);
  if (repeated.length > 0) {
    problems.push(`${repeated.map(id => `"${id}"`).join(', ')} the run has already: a stage's tasks are new ones`);
  }

  if (next.designReview === false && loaded.record.designReview === true) {
    problems.push(
      'designReview: false — the run has a designer review its UI since it opened, and a stage keeps that (its tasks in review wait for theirs): leave designReview out'
    );
  }

  // Checked as a plan of its own, a dependency on the run's tasks set aside — the run has them — and put back after.
  const outside = (task: RunPlan['tasks'][number]): string[] =>
    task.dependsOn.filter(dependency => known.has(dependency));
  let checked: CheckedPlan | undefined;
  const approved = (await readApproved(loaded.paths)).files;
  const work = await materialise(
    ctx,
    loaded,
    Object.fromEntries(Object.entries(approved).map(([file, each]) => [file, each.digest]))
  );
  try {
    checked = await checkPlan(
      ctx.root,
      { ...next, tasks: next.tasks.map(task => ({ ...task, dependsOn: task.dependsOn.filter(id => !known.has(id)) })) },
      await readOwnership(ctx.root),
      team,
      new Set((loaded.plan.inventory ?? []).map(item => item.id)),
      new Set(
        Object.entries(approved)
          .filter(([, each]) => each.digest !== null)
          .map(([file]) => file)
      ),
      (
        await Promise.all(
          loaded.tasks
            .filter(task => task.role !== 'lead' && !isResearch(task))
            .map(async task => (await viewTask(loaded.paths, task)).state.status)
        )
      ).filter(status => status !== 'done').length,
      work,
      loaded.tasks
    );
  } catch (error) {
    if (error instanceof PlanRefusal) {
      problems.push(...error.problems);
    } else {
      throw error;
    }
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }

  // A stage copies the run's site unless it names its own: what its values are measured against.
  if (checked && next.reference === undefined) {
    checked.notices.push(...unmeasuredNotices(next.tasks, loaded.plan.reference));
  }

  const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
  const held = new Map(
    views
      .filter(view => view.state.status !== 'done')
      .flatMap(view => view.task.files.map(each => [each, view.task.id] as const))
  );
  // What a new task waits for, all the way back — through the new plan's tasks to the run's.
  const waitsFor = (id: string, seen = new Set<string>()): Set<string> => {
    // The lead's tasks, with the dependencies on the run's own — or one the CLI added (a developer task's tests).
    const planned = next.tasks.find(each => each.id === id) ?? checked?.tasks.find(each => each.id === id);
    for (const dependency of planned?.dependsOn ?? []) {
      if (!seen.has(dependency)) {
        seen.add(dependency);
        waitsFor(dependency, seen);
      }
    }

    return seen;
  };
  for (const task of checked?.tasks ?? []) {
    // A file a task at work holds is named only by one that starts after it: waiting for it, it finds the file free.
    const after = waitsFor(task.id);
    for (const each of task.files.filter(owned => held.has(owned) && !after.has(held.get(owned) ?? ''))) {
      problems.push(
        `Task "${task.id}": ${each} is "${String(held.get(each))}"'s, still at work — wait for it (dependsOn) to name it`
      );
    }

    // A folder it names holds what a task at work writes there — files that task may not have made yet (// t-close-home's src/space/pages/home, t-home-top's sections in it, its topStyles.ts in no copy but its own).
    const named = next.tasks.find(each => each.id === task.id)?.files ?? [];
    const inside = [...held].filter(
      ([file, holder]) => !after.has(holder) && named.some(folder => file.startsWith(`${folder}/`))
    );
    for (const holder of new Set(inside.map(([, each]) => each))) {
      problems.push(
        `Task "${task.id}": ${inside
          .filter(([, each]) => each === holder)
          .map(([file]) => file)
          .join(
            ', '
          )} — in a folder it names — ${inside.length === 1 ? 'is' : 'are'} "${holder}"'s, still at work — wait for it (dependsOn)`
      );
    }
  }

  if (problems.length > 0 || !checked) {
    throw new RunRefusal(
      'invalid',
      `The plan is not stacked on "${runId}":\n${problems.map(each => `  - ${each}`).join('\n')}`,
      {
        problems
      }
    );
  }

  const primer = await readPrimer(next, file);
  const tasks: RunTask[] = checked.tasks.map(task => {
    const planned = next.tasks.find(each => each.id === task.id);

    return { ...task, dependsOn: [...task.dependsOn, ...(planned ? outside(planned) : [])] };
  });

  const states = new Map(views.map(view => [view.task.id, view.state.status]));
  const isReady = (task: RunTask): boolean => task.dependsOn.every(dependency => states.get(dependency) === 'done');
  // A stage is seen before it is stacked: `run plan` with a run open says it so — every check above, nothing written.
  if (dryRun) {
    return {
      runId,
      added: tasks.map(task => task.id),
      ready: tasks.filter(isReady).map(task => task.id),
      notes: next.notes?.length ?? 0,
      primer: primer !== undefined,
      checked: { ...checked, tasks },
      ...(lines ? { tried: await tryLines(ctx, loaded, tasks) } : {})
    };
  }

  // Their files as the project holds them now, kept beside the run's backup: what the finish restores from.
  const base = await readJson(loaded.paths.base, isBaseManifest, 'the run’s backup (base.json)');
  const fresh = [...new Set(tasks.flatMap(task => task.files))].filter(
    each => !base || !Object.hasOwn(base.files, each)
  );
  const kept = await keepFiles(loaded.paths, ctx.root, fresh);
  if (base) {
    await writeJson(loaded.paths.base, { ...base, files: { ...base.files, ...kept } });
  }

  const ready: string[] = [];
  const at = ctx.now().toISOString();
  for (const task of tasks) {
    const paths = taskPaths(loaded.paths, task.id);
    await writeJson(paths.definition, task);
    const state = startingState(task, isReady(task), at);
    await writeJson(paths.state, state);
    if (state.status !== 'pending') {
      ready.push(task.id);
    }
  }

  // A piece the run left out that the stage now proves is waiting no more: kept in the inventory, its reason dropped.
  const coveredNow = new Set(next.tasks.flatMap(task => task.acceptance.flatMap(coversOf)));
  const takenUp = (loaded.plan.inventory ?? [])
    .filter(item => item.leftOut !== undefined && coveredNow.has(item.id))
    .map(item => item.id);
  const plan: RunPlan = {
    ...loaded.plan,
    // A stage that says the run's goal again — a scope's, filled in from the run — adds nothing to it (`run
    // status` said the goal twice after its scope's stage).
    goal:
      next.goal.trim() === '' || loaded.plan.goal.split(' · ').includes(next.goal)
        ? loaded.plan.goal
        : `${loaded.plan.goal} · ${next.goal}`,
    tasks: [...loaded.plan.tasks, ...next.tasks],
    notes: [...(loaded.plan.notes ?? []), ...(next.notes ?? [])],
    ...(loaded.plan.leftOut || next.leftOut
      ? { leftOut: [...(loaded.plan.leftOut ?? []), ...(next.leftOut ?? [])] }
      : {}),
    ...(loaded.plan.inventory || next.inventory
      ? {
          inventory: [
            ...(loaded.plan.inventory ?? []).map(({ leftOut, ...item }) =>
              takenUp.includes(item.id) || leftOut === undefined ? item : { ...item, leftOut }
            ),
            ...(next.inventory ?? [])
          ]
        }
      : {}),
    ...(next.contracts ? { contracts: [...(loaded.plan.contracts ?? []), ...next.contracts] } : {})
  };
  await writeJson(loaded.paths.plan, plan);
  if (primer !== undefined) {
    await writeAtomic(loaded.paths.primer, primer);
  }

  const handed = await handedInputs(ctx, [file, primerFile(next, file)]);
  // Inside the project, the stage's plan and primer are the run's now: in its folder, under the stage's name.
  const inputs = await takeInputs(ctx, loaded.paths, [file, primerFile(next, file)], next.runId);
  await updateRecord(ctx, loaded.paths, record => ({
    ...record,
    agents: allowed,
    // The stage's plan and its primer are the run's now: removed with it, as the plan it opened with.
    inputs: withInputs(
      record.inputs,
      handed.filter(input => !inputs.some(moved => moved.endsWith(path.basename(input.file))))
    ),
    // The run's choice, made when it opened: a stage turns it on when it says so, never because of who is in the team.
    ...(record.designReview === true || next.designReview === true ? { designReview: true as const } : {}),
    estimate: {
      ...record.estimate,
      // Worked by as many as it may be now: a run opened on its scope alone was estimated for one.
      agents: Math.max(record.estimate.agents, allowed),
      tasks: record.estimate.tasks + tasks.length,
      totalMinutes: record.estimate.totalMinutes + checked.estimate.totalMinutes,
      wallMinutes: record.estimate.wallMinutes + checked.estimate.wallMinutes
    }
  }));
  for (const note of next.notes ?? []) {
    await sendMessage(ctx, loaded, { from: LEAD, to: EVERYONE, text: note });
  }

  await logRun(ctx, loaded.paths, {
    action: 'extend',
    stage: next.runId,
    goal: next.goal,
    added: tasks.map(task => task.id),
    ...(takenUp.length > 0 ? { takenUp } : {})
  });

  return {
    runId,
    added: tasks.map(task => task.id),
    ready,
    notes: next.notes?.length ?? 0,
    primer: primer !== undefined,
    ...(allowed > loaded.record.agents ? { agents: { before: loaded.record.agents, after: allowed } } : {}),
    ...(inputs.length > 0 ? { inputs } : {}),
    ...(takenUp.length > 0 ? { takenUp } : {}),
    ...(checked.notices.length > 0 ? { notices: checked.notices } : {})
  };
};
