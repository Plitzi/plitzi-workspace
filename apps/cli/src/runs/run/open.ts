import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { assertNoOtherRun, claimProject, handedInputs, releaseProject, takeInputs } from './claim';
import { requireNoTask, requirePerson } from './context';
import { assertStatus, loadRun, logRun, pinnedNow, readRecord, updateRecord } from './record';
import { ensureTeam, teamSize } from '../agents/team';
import { readOwnership } from '../copies/ownership';
import { readOptional, writeAtomic, writeJson } from '../core/files';
import { isRunPlan } from '../core/model';
import { runPaths, runsDir, taskPaths } from '../core/paths';
import { RunRefusal } from '../core/refusal';
import { keepFiles } from '../core/store';
import { LARGE_OUTPUT } from '../findings/cost';
import { checkPlan, PlanRefusal } from '../plan/plan';
import { runPlanProblems } from '../plan/planProblems';
import { startingState } from '../plan/spike';
import { runReportDir } from '../report/reports';
import { EVERYONE, LEAD, sendMessage } from '../talk/messages';

import type { RunContext } from './context';
import type { Team } from '../agents/team';
import type { Ownership } from '../copies/ownership';
import type { ApprovedManifest, BaseManifest, RunPlan, RunRecord, SharedManifest } from '../core/model';
import type { RunPaths } from '../core/paths';
import type { CheckedPlan } from '../plan/plan';

/**
 * `plitzi run open` — and its `--dry-run`: a plan read and held to the rules, with its primer and the team that works it — and
 * opened, every file it touches backed up first.
 */

export interface OpenedRun {
  checked: CheckedPlan;
  paths: RunPaths;
  backedUp: number;
  /** The plan and its primer, moved into the run's folder from the project: where the lead edits them now. */
  inputs: string[];
}

export const readPlanFile = async (
  file: string,
  /**
   * What a stage stacked on an open run may leave out — its name and its goal, the run's — filled before it is read:
   * A run's spike was refused its four tasks for a runId and a goal the run had.
   */
  fill?: { runId: string; goal: string }
): Promise<RunPlan> => {
  const bytes = await readOptional(file);
  if (bytes === undefined) {
    throw new RunRefusal('not-found', `There is no plan at ${file}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf-8'));
  } catch {
    throw new RunRefusal('invalid', `${file} is not JSON`);
  }

  if (fill && isRecord(parsed)) {
    parsed = {
      ...parsed,
      ...(parsed.runId === undefined ? { runId: fill.runId } : {}),
      ...(parsed.goal === undefined ? { goal: fill.goal } : {}),
      ...(parsed.version === undefined ? { version: 1 } : {})
    };
  }

  // A task that waits for none may leave `dependsOn` out: two plans in a row were refused for it, a lead's and a
  // person's, each task's "[] for none".
  if (isRecord(parsed) && Array.isArray(parsed.tasks)) {
    parsed = {
      ...parsed,
      tasks: parsed.tasks.map((task: unknown) =>
        isRecord(task) && task.dependsOn === undefined ? { ...task, dependsOn: [] } : task
      )
    };
  }

  // A task's findings written as a list, one finding a line, are its findings: said as words, each its own line
  // (the scope's stage refused for ten lists — "in words, not […]").
  if (isRecord(parsed) && Array.isArray(parsed.tasks)) {
    parsed = {
      ...parsed,
      tasks: parsed.tasks.map((task: unknown) =>
        isRecord(task) && Array.isArray(task.findings) && task.findings.every(line => typeof line === 'string')
          ? { ...task, findings: task.findings.map(line => (line.startsWith('- ') ? line : `- ${line}`)).join('\n') }
          : task
      )
    };
  }

  if (!isRunPlan(parsed)) {
    const problems = runPlanProblems(parsed);
    throw new RunRefusal(
      'invalid',
      `${file} is not a plan — { version: 1, runId, goal, tasks: [{ id, title, files, dependsOn, priority, estimateMinutes, acceptance }] }${
        problems.length > 0 ? `:\n${problems.map(each => `  - ${each}`).join('\n')}` : ''
      }`,
      { problems }
    );
  }

  return parsed;
};

/** `plitzi run open --dry-run`: the plan held to the rules, expanded and estimated — nothing written. */
export const checkPlanFile = async (ctx: RunContext, file: string): Promise<CheckedPlan> => {
  await assertNoOtherRun(ctx);

  return (await readCheckedPlan(ctx.root, file)).checked;
};

/** A plan file read and checked against the project as it is, with the ownership it was checked by — no run touched. */
/** A primer is read whole by every agent: past this it no longer saves what it is for. */
export const MAX_PRIMER_BYTES = 16 * 1024;

/** Where the plan's primer is: beside the plan, as it names it. */
export const primerFile = (plan: RunPlan, planFile: string): string | undefined =>
  plan.primer === undefined ? undefined : path.resolve(path.dirname(planFile), plan.primer);

/** The plan's primer, read beside the plan — refused, saying why, when it is not there or too long to be one. */
export const readPrimer = async (plan: RunPlan, planFile: string): Promise<string | undefined> => {
  const file = primerFile(plan, planFile);
  if (file === undefined) {
    return undefined;
  }

  const text = await fs.readFile(file, 'utf-8').catch(() => undefined);
  if (text === undefined || text.trim() === '') {
    throw new RunRefusal(
      'invalid',
      `The plan's primer ${plan.primer} is not there, or is empty (read beside the plan: ${file})`
    );
  }

  if (Buffer.byteLength(text) > MAX_PRIMER_BYTES) {
    throw new RunRefusal(
      'invalid',
      `The plan's primer is ${String(Math.round(Buffer.byteLength(text) / 1024))} KB, over ${String(MAX_PRIMER_BYTES / 1024)}: every agent reads it whole to start — keep what each task needs, and name the references for the rest`
    );
  }

  return text;
};

/**
 * Half an answer an agent pays for on every turn: a task's first brief is the primer and the task's own, its imports'
 * half the rest — a run's 9.7 KB primer put all 19 of its briefs over, read again for 1.9M tokens.
 */
const PRIMER_LIGHT = LARGE_OUTPUT / 2;

/** A primer heavy enough to put every first brief over what an agent reads again cheaply, said with what it costs. */
export const heavyPrimer = (primer: string | undefined, tasks: number): string[] => {
  const bytes = primer === undefined ? 0 : Buffer.byteLength(primer);

  return bytes > PRIMER_LIGHT
    ? [
        `The primer is ${(bytes / 1024).toFixed(1)} KB: every task's first brief carries it whole — ${String(tasks)} tasks read ${String(Math.round((bytes * tasks) / 1024))} KB of it before their own, again on every turn after. Over ${String(PRIMER_LIGHT / 1000)}k it outweighs a task's own brief: keep what every task needs, and say where the rest is (a file, a skill)`
      ]
    : [];
};

export const readCheckedPlan = async (
  root: string,
  file: string
): Promise<{ checked: CheckedPlan; ownership: Ownership; team: Team }> => {
  const plan = await readPlanFile(file);
  const primer = await readPrimer(plan, file);
  const ownership = await readOwnership(root);
  // The team works the run, and says how many at once: a project's first run writes the one its plan needs.
  const { team, created } = await ensureTeam(root, plan);
  try {
    const checked = await checkPlan(root, plan, ownership, team);
    const notices = [...(created ? [created] : []), ...checked.notices, ...heavyPrimer(primer, checked.tasks.length)];

    return {
      checked: { ...checked, notices },
      ownership,
      team
    };
  } catch (error) {
    if (error instanceof PlanRefusal) {
      throw new RunRefusal('invalid', error.message, { problems: error.problems });
    }

    throw error;
  }
};

/**
 * `plitzi run open`: the plan checked, its folder made, and every file it will touch backed up before anything is
 * touched. Above the threshold of §14, a person confirms the estimate first.
 */
/** What a person grants when the lead may write the run into the project: said in the words they confirm. */
const LEAD_FINISHES =
  'let the lead write it into the project itself, once its report is written and the checks pass on the whole result';

export const openRun = async (
  ctx: RunContext,
  file: string,
  { leadFinishes = false, despiteChecks }: { leadFinishes?: boolean; despiteChecks?: string } = {}
): Promise<OpenedRun> => {
  requireNoTask(ctx, 'open a run');
  const plan = await readPlanFile(file);
  await assertNoOtherRun(ctx);
  const { checked, team } = await readCheckedPlan(ctx.root, file);
  const agents = teamSize(team);
  const paths = runPaths(ctx.root, checked.runId);
  if (await readRecord(paths).catch(() => undefined)) {
    throw new RunRefusal(
      'invalid',
      `There is a run "${checked.runId}" already: attach to it (plitzi run attach ${checked.runId}), or a person purges it`,
      { run: checked.runId }
    );
  }

  // A run's reports are kept by its id: a second run of one name would write over the first's — its team's and Plitzi's.
  const reported = runReportDir(ctx.root, checked.runId);
  if (await fs.stat(reported).catch(() => undefined)) {
    throw new RunRefusal(
      'invalid',
      `A run "${checked.runId}" already ended in this project: its reports are in ${path.relative(ctx.root, reported)}. Give this plan a runId of its own`,
      { run: checked.runId }
    );
  }

  // The project's own checks, before any agent works: a failure there meets every task's check in its copy, and spends
  // its tries on what no task did (Carlos: the lead sees lint and types clean before the agents begin). Opened despite
  // them only said why — logged, and told to every task.
  const before = await ctx.checks(ctx.root, ctx.root);
  if (!before.ok && despiteChecks === undefined) {
    throw new RunRefusal(
      'checks-failed',
      `The project fails its own checks before the run (${before.steps
        .filter(step => !step.ok)
        .map(step => step.name)
        .join(
          ', '
        )}): every task would meet them in its copy. Fix them first — or open it despite them, saying why: plitzi run open <plan> --despite-checks "…", or plitzi run start "<ask>" --despite-checks "…"`,
      {
        steps: before.steps.filter(step => !step.ok),
        // The project's, not a task's: what was said of a task's check ("complete again") is no step of an opener's.
        next: 'fix each step marked ✗ below in the project, then open the run again — or open it despite them, saying why'
      }
    );
  }

  let confirmed: string | undefined;
  if (checked.estimate.needsConfirmation) {
    await requirePerson(ctx, checked.runId, `open a run of ${checked.estimate.why ?? 'this size'}`);
    confirmed = ctx.now().toISOString();
  }

  // Asked before anything is made: a refusal here leaves no run half-opened.
  if (leadFinishes) {
    await requirePerson(ctx, checked.runId, `open run "${checked.runId}" and ${LEAD_FINISHES}`);
  }

  await fs.mkdir(runsDir(ctx.root), { recursive: true });
  await claimProject(ctx, checked.runId);
  try {
    await fs.mkdir(paths.dir);
  } catch {
    await releaseProject(ctx.root, checked.runId);
    throw new RunRefusal('another-run', `Run "${checked.runId}" was opened meanwhile by someone else`, {
      run: checked.runId
    });
  }

  const at = ctx.now().toISOString();
  const touched = [
    ...new Set([...checked.tasks.flatMap(task => task.files), ...checked.shared.map(shared => shared.file)])
  ].sort();
  const base: BaseManifest = { at, files: await keepFiles(paths, ctx.root, touched) };
  await writeJson(paths.base, base);
  await writeJson(paths.approved, { files: {}, tasks: [] } satisfies ApprovedManifest);
  await writeJson(paths.shared, { files: checked.shared } satisfies SharedManifest);
  const primer = await readPrimer(plan, file);
  if (primer !== undefined) {
    await writeAtomic(paths.primer, primer);
  }
  for (const task of checked.tasks) {
    const taskFiles = taskPaths(paths, task.id);
    await writeJson(taskFiles.definition, task);
    await writeJson(taskFiles.state, startingState(task, task.dependsOn.length === 0, at));
  }

  const record: RunRecord = {
    version: 1,
    runId: checked.runId,
    status: 'open',
    openedAt: at,
    activeOn: { machine: ctx.machine, since: at },
    pinned: await pinnedNow(ctx.root, ctx.cli),
    agents,
    estimate: {
      tasks: checked.estimate.tasks,
      agents: checked.estimate.agents,
      wallMinutes: checked.estimate.wallMinutes,
      totalMinutes: checked.estimate.totalMinutes
    },
    ...(confirmed ? { confirmed } : {}),
    ...(leadFinishes ? { leadFinishes: ctx.now().toISOString() } : {}),
    brake: [],
    completions: { completed: 0, refused: 0, 'checks-failed': 0, conflict: 0 },
    merges: [],
    inputs: await handedInputs(ctx, [file, primerFile(plan, file)])
  };
  // Inside the project, they are the run's now: moved into its folder, and no longer inputs to remove after it.
  const inputs = await takeInputs(ctx, paths, [file, primerFile(plan, file)]);
  if (inputs.length > 0) {
    record.inputs = [];
  }

  // The plan as its lead wrote it, last: a folder with a plan and a record is a run.
  await writeJson(paths.plan, plan);
  await writeJson(paths.record, record);
  // The notes the plan carries are the run's memory from its first take on.
  const opened = await loadRun(ctx, plan.runId);
  for (const text of plan.notes ?? []) {
    await sendMessage(ctx, opened, { from: LEAD, to: EVERYONE, text });
  }

  const failing = before.steps.filter(step => !step.ok).map(step => step.name);
  if (failing.length > 0 && despiteChecks !== undefined) {
    await sendMessage(ctx, opened, {
      from: LEAD,
      to: EVERYONE,
      // Said as the checks now say it: a step the run's work fails the same way is no copy's (`notOwn`), its acceptance run
      // all the same — a known failure for it was what agents were told, and is no longer needed.
      text: `The project failed ${failing.join(', ')} before the run, and it was opened despite it: ${despiteChecks}. It is none of yours: your checks say it is the run's, and it stops none of your work`
    });
  }

  await logRun(ctx, paths, {
    action: 'open',
    tasks: checked.tasks.length,
    taskIds: checked.tasks.map(task => task.id),
    backedUp: touched.length,
    agents,
    ...(plan.inventory ? { inventory: plan.inventory.length } : {}),
    ...(checked.leftOut.length > 0 ? { leftOut: checked.leftOut } : {}),
    notices: checked.notices.length,
    // Opened on a plan written before it, the lead's research is in no record of the run: said, and shown as such.
    ...(checked.tasks.some(task => task.spike !== undefined) ? {} : { scoped: 'before' }),
    ...(failing.length > 0 ? { failingBefore: failing, despiteChecks } : {})
  });

  return { checked, paths, backedUp: touched.length, inputs };
};

/**
 * `plitzi run finish --lead-finishes`: a person lets the lead of an open run write it into the project itself — or, `--no-lead-finishes`,
 * takes that back. A person's, confirmed by typing the run's name: an agent never grants itself the project.
 */
export const allowLeadFinish = async (
  ctx: RunContext,
  runId: string,
  { revoke = false }: { revoke?: boolean } = {}
): Promise<{ runId: string; leadFinishes: boolean; was: boolean }> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping', 'stopped'], revoke ? 'take back the lead’s finish' : 'let the lead finish');
  const was = loaded.record.leadFinishes !== undefined;
  if (was === !revoke) {
    throw new RunRefusal(
      'invalid',
      revoke
        ? `The lead of "${runId}" may not write it into the project already: a person does (plitzi run finish --apply)`
        : `The lead of "${runId}" may write it into the project already, since ${String(loaded.record.leadFinishes)}`,
      { run: runId }
    );
  }

  await requirePerson(
    ctx,
    runId,
    revoke ? `take back the lead's finish of run "${runId}"` : `${LEAD_FINISHES} (run "${runId}")`
  );
  const at = ctx.now().toISOString();
  await updateRecord(ctx, loaded.paths, record => {
    const next = { ...record };
    if (revoke) {
      delete next.leadFinishes;
    } else {
      next.leadFinishes = at;
    }

    return next;
  });
  await logRun(ctx, loaded.paths, { action: revoke ? 'revoke-lead-finish' : 'allow-lead-finish' });

  return { runId, leadFinishes: !revoke, was };
};
