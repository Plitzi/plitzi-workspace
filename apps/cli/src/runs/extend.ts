import { readJson, writeAtomic, writeJson } from './files';
import { coLeadsOf, requireLead } from './leads';
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
  readPlanFile,
  readPrimer,
  requireNoTask,
  updateRecord,
  withInputs
} from './run';
import { keepFiles } from './store';
import { viewTask } from './taskStore';
import { coLeadNames, ensureTeam, reviewsDesign, teamSize } from './team';

import type { RunPlan, RunTask, TaskState } from './model';
import type { CheckedPlan } from './plan';
import type { RunContext } from './run';

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
  /** The leads that review the stage adds, by name: start each (`plitzi run plan` says how). */
  newLeads?: string[];
  /** `dryRun`: the stage as it would be stacked — its tasks with the CLI's, estimated — and nothing written. */
  checked?: CheckedPlan;
}

export const extendRun = async (
  ctx: RunContext,
  runId: string,
  file: string,
  { dryRun = false }: { dryRun?: boolean } = {}
): Promise<Extended> => {
  requireNoTask(ctx, 'extend a run');
  const loaded = await loadRun(ctx, runId);
  await requireLead(ctx, loaded, 'stack a stage on the run');
  assertStatus(loaded, ['open'], 'extend');
  const next: RunPlan = await readPlanFile(file);
  const { team } = await ensureTeam(ctx.root, next);
  // A stage worked by a larger team lets them work: never fewer than the run had.
  const allowed = Math.max(loaded.record.agents, teamSize(team));
  const leads = [...new Set([...coLeadsOf(loaded.record), ...coLeadNames(team)])];
  const known = new Set(loaded.tasks.map(task => task.id));
  const problems: string[] = [];
  const repeated = next.tasks.filter(task => known.has(task.id)).map(task => task.id);
  if (repeated.length > 0) {
    problems.push(`${repeated.map(id => `"${id}"`).join(', ')} the run has already: a stage's tasks are new ones`);
  }

  // Checked as a plan of its own, a dependency on the run's tasks set aside — the run has them — and put back after.
  const outside = (task: RunPlan['tasks'][number]): string[] =>
    task.dependsOn.filter(dependency => known.has(dependency));
  let checked: CheckedPlan | undefined;
  try {
    checked = await checkPlan(
      ctx.root,
      { ...next, tasks: next.tasks.map(task => ({ ...task, dependsOn: task.dependsOn.filter(id => !known.has(id)) })) },
      await readOwnership(ctx.root),
      team
    );
  } catch (error) {
    if (error instanceof PlanRefusal) {
      problems.push(...error.problems);
    } else {
      throw error;
    }
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
      checked: { ...checked, tasks }
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
    await writeJson(paths.state, {
      status: isReady(task) ? 'ready' : 'pending',
      round: 0,
      notes: [],
      updatedAt: at
    } satisfies TaskState);
    if (isReady(task)) {
      ready.push(task.id);
    }
  }

  const plan: RunPlan = {
    ...loaded.plan,
    goal: `${loaded.plan.goal} · ${next.goal}`,
    tasks: [...loaded.plan.tasks, ...next.tasks],
    notes: [...(loaded.plan.notes ?? []), ...(next.notes ?? [])],
    ...(next.contracts ? { contracts: [...(loaded.plan.contracts ?? []), ...next.contracts] } : {})
  };
  await writeJson(loaded.paths.plan, plan);
  if (primer !== undefined) {
    await writeAtomic(loaded.paths.primer, primer);
  }

  const handed = await handedInputs(ctx, [file, primerFile(next, file)]);
  await updateRecord(ctx, loaded.paths, record => ({
    ...record,
    agents: allowed,
    ...(leads.length > 0 ? { leads } : {}),
    // The stage's plan and its primer are the run's now: removed with it, as the plan it opened with.
    inputs: withInputs(record.inputs, handed),
    ...(record.designReview === true || reviewsDesign(team, next) ? { designReview: true as const } : {}),
    estimate: {
      ...record.estimate,
      tasks: record.estimate.tasks + tasks.length,
      totalMinutes: record.estimate.totalMinutes + checked.estimate.totalMinutes,
      wallMinutes: record.estimate.wallMinutes + checked.estimate.wallMinutes
    }
  }));
  for (const note of next.notes ?? []) {
    await sendMessage(ctx, loaded, { from: LEAD, to: EVERYONE, text: note });
  }

  await logRun(ctx, loaded.paths, { action: 'extend', stage: next.runId, added: tasks.map(task => task.id) });

  return {
    runId,
    added: tasks.map(task => task.id),
    ready,
    notes: next.notes?.length ?? 0,
    primer: primer !== undefined,
    ...(allowed > loaded.record.agents ? { agents: { before: loaded.record.agents, after: allowed } } : {}),
    ...(leads.length > coLeadsOf(loaded.record).length
      ? { newLeads: leads.filter(each => !coLeadsOf(loaded.record).includes(each)) }
      : {})
  };
};
