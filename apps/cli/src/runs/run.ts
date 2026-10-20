import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { createExclusive, fingerprint, readJson, readOptional, sizeOf, writeAtomic, writeJson } from './files';
import { EVERYONE, LEAD, sendMessage } from './messages';
import { isApprovedManifest, isBaseManifest, isRunPlan, isRunRecord, isSharedManifest } from './model';
import { readOwnership } from './ownership';
import { activeRunFile, ID, runPaths, runsDir, taskPaths } from './paths';
import { checkPlan, PlanRefusal } from './plan';
import { RunRefusal } from './refusal';
import { keepFiles, withLock } from './store';
import { appendLog, cutTask, DEFAULTS, readTasks, viewTask } from './taskStore';
import { ensureTeam, reviewsDesign, teamSize } from './team';

import type { CheckRunner } from './checks';
import type {
  ApprovedManifest,
  BaseManifest,
  BrakeEvent,
  Pinned,
  RunPlan,
  RunRecord,
  RunTask,
  SharedManifest,
  TaskState
} from './model';
import type { Ownership } from './ownership';
import type { RunPaths } from './paths';
import type { CheckedPlan } from './plan';
import type { Team } from './team';

/**
 * A run (RFC 0028): its folder, its record, and what may be done to it by whom. Every command of `plitzi run` and
 * `plitzi task` goes through `loadRun`, which refuses on the spot what the run's state does not allow — another machine
 * holds it, the Plitzi version changed under it — so no command has to remember to.
 */

/** Asks a person to confirm `action` on `runId`, by typing the run's name; false when no person can be asked here. */
export type PersonGate = (runId: string, action: string) => Promise<boolean>;

export interface RunContext {
  root: string;
  now: () => Date;
  machine: string;
  cli: string;
  /** The caller's task token: an agent working a task. A person, or the lead, has none. */
  token?: string;
  /** Who is calling, for the log: an agent's name, or `person`. */
  agent: string;
  person: PersonGate;
  checks: CheckRunner;
}

export interface LoadedRun {
  paths: RunPaths;
  plan: RunPlan;
  record: RunRecord;
  tasks: RunTask[];
}

/** A person's action: refused with a task's token, and without a person at the terminal to confirm it. */
export const requirePerson = async (ctx: RunContext, runId: string, action: string): Promise<void> => {
  if (ctx.token !== undefined) {
    throw new RunRefusal('person-only', `Only a person may ${action}: a task's token cannot.`);
  }

  if (!(await ctx.person(runId, action))) {
    throw new RunRefusal(
      'person-only',
      `Only a person may ${action}, confirming it by typing the run's name in their own terminal.`
    );
  }
};

/** The lead's or a person's: refused with a task's token — a task does not approve, stop or reassign. */
export const requireNoTask = (ctx: RunContext, action: string): void => {
  if (ctx.token !== undefined) {
    throw new RunRefusal('person-only', `A task's token cannot ${action}: the lead or a person does.`);
  }
};

/** What the run pins: this CLI, and every `@plitzi/*` package the project has installed. */
export const pinnedNow = async (root: string, cli: string): Promise<Pinned> => {
  const scope = path.join(root, 'node_modules', '@plitzi');
  const names = await fs.readdir(scope).catch(() => []);
  const packages: Record<string, string> = {};
  for (const name of names.sort()) {
    const bytes = await readOptional(path.join(scope, name, 'package.json'));
    if (bytes === undefined) {
      continue;
    }

    const manifest: unknown = JSON.parse(bytes.toString('utf-8'));
    if (isRecord(manifest) && typeof manifest.version === 'string') {
      packages[`@plitzi/${name}`] = manifest.version;
    }
  }

  return { cli, packages };
};

const samePinned = (a: Pinned, b: Pinned): boolean => JSON.stringify(a) === JSON.stringify(b);

const pinnedChanges = (was: Pinned, now: Pinned): string[] => {
  const changes = was.cli === now.cli ? [] : [`@plitzi/cli ${was.cli} → ${now.cli}`];
  const names = new Set([...Object.keys(was.packages), ...Object.keys(now.packages)]);
  for (const name of [...names].sort()) {
    if (was.packages[name] !== now.packages[name]) {
      changes.push(`${name} ${was.packages[name] ?? 'none'} → ${now.packages[name] ?? 'none'}`);
    }
  }

  return changes;
};

export const readRecord = async (paths: RunPaths): Promise<RunRecord | undefined> =>
  readJson(paths.record, isRunRecord, 'a run’s record (run.json)');

export const readBase = async (paths: RunPaths): Promise<BaseManifest> =>
  (await readJson(paths.base, isBaseManifest, 'a run’s backup (base.json)')) ?? { at: '', files: {} };

export const readApproved = async (paths: RunPaths): Promise<ApprovedManifest> =>
  (await readJson(paths.approved, isApprovedManifest, 'a run’s approved work (approved.json)')) ?? {
    files: {},
    tasks: []
  };

export const readShared = async (paths: RunPaths): Promise<SharedManifest> =>
  (await readJson(paths.shared, isSharedManifest, 'what a run shares (shared.json)')) ?? { files: [] };

export interface LoadOptions {
  /** Read it from a machine it is not active on: to look at it, or for a person to take it over. */
  anyMachine?: boolean;
  /** Read it although the Plitzi version changed under it: to look at it, or to attach to it again. */
  anyVersion?: boolean;
}

export const loadRun = async (ctx: RunContext, runId: string, options: LoadOptions = {}): Promise<LoadedRun> => {
  if (!ID.test(runId)) {
    throw new RunRefusal('invalid', `"${runId}" is not a run's name: lowercase letters, digits, - and _`);
  }

  const paths = runPaths(ctx.root, runId);
  const record = await readRecord(paths);
  const plan = await readJson(paths.plan, isRunPlan, 'a run’s plan (plan.json)');
  if (!record || !plan) {
    throw new RunRefusal('not-found', `There is no run "${runId}" in this project (${runsDir(ctx.root)})`, {
      run: runId
    });
  }

  if (!options.anyMachine && record.activeOn.machine !== ctx.machine) {
    throw new RunRefusal(
      'other-machine',
      record.activeOn.machine === ''
        ? `Run "${runId}" was released: attach to it here first (plitzi run attach ${runId})`
        : `Run "${runId}" is active on ${record.activeOn.machine}, not here (${ctx.machine})`,
      { run: runId, holder: record.activeOn.machine }
    );
  }

  if (!options.anyVersion) {
    const pinned = await pinnedNow(ctx.root, ctx.cli);
    if (!samePinned(record.pinned, pinned)) {
      throw new RunRefusal(
        'version-mismatch',
        `The Plitzi version changed while run "${runId}" is open: ${pinnedChanges(record.pinned, pinned).join(', ')}. A person attaches to it again (plitzi run attach ${runId}), which re-pins it and starts the tasks in hand again from their reviewed versions.`,
        { run: runId }
      );
    }
  }

  // In the plan's order, the tasks the CLI made after: what `run status` and the report list them by.
  const order = new Map(plan.tasks.map((task, index) => [task.id, index]));
  const tasks = (await readTasks(paths)).sort(
    (a, b) => (order.get(a.id) ?? order.size) - (order.get(b.id) ?? order.size) || a.id.localeCompare(b.id)
  );

  return { paths, plan, record, tasks };
};

/** Changes the run's record under its merge lock: one writer at a time, whoever it is. */
export const updateRecord = async (
  ctx: RunContext,
  paths: RunPaths,
  change: (record: RunRecord) => RunRecord
): Promise<RunRecord> =>
  withLock(
    paths.mergeLock,
    async () => {
      const record = await readRecord(paths);
      if (!record) {
        throw new RunRefusal('not-found', `The run's record is gone from ${paths.dir}`);
      }

      const next = change(record);
      await writeJson(paths.record, next);

      return next;
    },
    { now: ctx.now }
  );

export const logRun = (ctx: RunContext, paths: RunPaths, entry: Record<string, unknown>): Promise<void> =>
  appendLog(paths.log, { at: ctx.now().toISOString(), by: ctx.agent, ...entry });

/** Refuses what a run's status does not allow, naming the status — `allowed` says what may go on. */
export const assertStatus = (loaded: LoadedRun, allowed: readonly RunRecord['status'][], action: string): void => {
  const { status, runId, reconciliation } = loaded.record;
  if (allowed.includes(status)) {
    return;
  }

  if (status === 'reconciliation') {
    throw new RunRefusal(
      'reconciliation',
      `Run "${runId}" is in reconciliation (${reconciliation?.reason ?? 'something left the flow'}): it cannot ${action} until the lead resolves it`,
      { run: runId, files: reconciliation?.files.map(file => file.file) ?? [] }
    );
  }

  const why = loaded.record.stopReason ? ` (${loaded.record.stopReason})` : '';
  if (status === 'stopping') {
    throw new RunRefusal(
      'stopping',
      `Run "${runId}" is stopping${why}: it cannot ${action} — the tasks in hand finish, and nothing starts until it is resumed (plitzi run resume ${runId})`,
      {
        run: runId,
        next: 'finish the task in hand; then wait for the resume (plitzi task next --follow waits through it)'
      }
    );
  }

  if (status === 'stopped') {
    throw new RunRefusal(
      loaded.record.forcedStopAt ? 'forced-stop' : 'stopping',
      loaded.record.forcedStopAt
        ? `Run "${runId}" was stopped at once${why}: it cannot ${action}. The tasks being written were cut; those in review keep their work. It goes on when the lead resumes it`
        : `Run "${runId}" is stopped${why}: it cannot ${action} until the lead resumes it`,
      { run: runId }
    );
  }

  throw new RunRefusal('invalid', `Run "${runId}" is ${status}: it cannot ${action}`, { run: runId });
};

/** Every run of the project, by name. */
export const runIds = async (root: string): Promise<string[]> => {
  const entries = await fs.readdir(runsDir(root), { withFileTypes: true }).catch(() => []);

  return entries
    .filter(entry => entry.isDirectory() && ID.test(entry.name))
    .map(entry => entry.name)
    .sort();
};

/** The runs of the project: every one still going — one, or none — what `plitzi upgrade` waits for. */
export const activeRuns = async (root: string): Promise<string[]> => {
  const active: string[] = [];
  for (const runId of await runIds(root)) {
    if (await readRecord(runPaths(root, runId)).catch(() => undefined)) {
      active.push(runId);
    }
  }

  return active;
};

/** How long a run takes to open at most: a claim older than this with no run behind it was cut, and is taken over. */
const CLAIM_GRACE_MS = 2 * 60_000;

const isActiveClaim = (value: unknown): value is { runId: string; since: string; by: string } =>
  isRecord(value) && typeof value.runId === 'string' && typeof value.since === 'string' && typeof value.by === 'string';

/** One run at a time: refused, naming it and how long it has been quiet, when another is going. */
export const assertNoOtherRun = async (ctx: RunContext, except?: string): Promise<void> => {
  const other = (await activeRuns(ctx.root)).find(runId => runId !== except);
  if (!other) {
    return;
  }

  const record = await readRecord(runPaths(ctx.root, other)).catch(() => undefined);
  throw new RunRefusal(
    'another-run',
    `Run "${other}" is going in this project${record ? ` (${record.status}, opened ${record.openedAt})` : ''}: one run at a time — stack the next plan on it (plitzi run extend ${other} <plan>: one finish for both), finish it (plitzi run finish ${other}), or a person aborts it (plitzi run abort ${other})`,
    { run: other }
  );
};

/**
 * Takes the project for `runId`: `active.json` created exclusively, so of two runs opening at once one wins. One a run
 * no longer has — gone, or never opened — is taken over.
 */
const claimProject = async (ctx: RunContext, runId: string): Promise<void> => {
  const file = activeRunFile(ctx.root);
  const mine = `${JSON.stringify({ runId, since: ctx.now().toISOString(), by: ctx.agent }, null, 2)}\n`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await createExclusive(file, mine)) {
      return;
    }

    const bytes = await readOptional(file);
    let claim: unknown;
    try {
      claim = bytes === undefined ? undefined : JSON.parse(bytes.toString('utf-8'));
    } catch {
      claim = undefined;
    }

    if (isActiveClaim(claim)) {
      const going = await readRecord(runPaths(ctx.root, claim.runId)).catch(() => undefined);
      // A claim with no run yet is a run still opening — its record is written last — unless it is old: then it was cut.
      const opening = !going && ctx.now().getTime() - Date.parse(claim.since) < CLAIM_GRACE_MS;
      if (going || opening) {
        throw new RunRefusal(
          'another-run',
          `Run "${claim.runId}" is ${going ? 'going' : 'opening'} in this project: one plan and one run at a time`,
          { run: claim.runId }
        );
      }
    }

    // Only the claim as read is taken away: one another run made meanwhile is not.
    const again = await readOptional(file);
    if (again === undefined || bytes === undefined || again.equals(bytes)) {
      await fs.rm(file, { force: true });
    }
  }

  throw new RunRefusal('another-run', `${file} keeps changing: another run is opening — try again in a moment`);
};

/** The project let go: its run is gone. */
const releaseProject = async (root: string, runId: string): Promise<void> => {
  const file = activeRunFile(root);
  const bytes = await readOptional(file);
  if (bytes === undefined) {
    return;
  }

  let claim: unknown;
  try {
    claim = JSON.parse(bytes.toString('utf-8'));
  } catch {
    claim = undefined;
  }

  if (!isActiveClaim(claim) || claim.runId === runId) {
    await fs.rm(file, { force: true });
  }
};

/**
 * A run gone, its folder with it — backups and every version it kept: once its work is in the project, or once a person
 * aborted it, nothing of it is left behind for anyone to clean up.
 */
export const removeRun = async (ctx: RunContext, paths: RunPaths, runId: string): Promise<RemovedInputs> => {
  const inputs = (await readRecord(paths).catch(() => undefined))?.inputs ?? [];
  await fs.rm(paths.dir, { recursive: true, force: true });
  await releaseProject(ctx.root, runId);

  return removeInputs(ctx, inputs);
};

export interface RemovedInputs {
  /** The plan and the summary the run was handed, gone with it. */
  removed: string[];
  /** …or kept, changed since the run read them: the lead's to keep or remove. */
  kept: string[];
}

/** What the lead handed the run, removed with it when it is as the run read it: no plan is left lying in the project. */
const removeInputs = async (ctx: RunContext, inputs: RunRecord['inputs']): Promise<RemovedInputs> => {
  const removed: string[] = [];
  const kept: string[] = [];
  for (const input of inputs) {
    const file = path.resolve(ctx.root, input.file);
    if ((await fingerprint(file)) === input.digest) {
      await fs.rm(file, { force: true });
      removed.push(input.file);
    } else if ((await fingerprint(file)) !== null) {
      kept.push(input.file);
    }
  }

  return { removed, kept };
};

/** A file the lead hands the run, by project path when it is in the project: what `removeRun` takes away with it. */
export const inputOf = async (ctx: RunContext, file: string): Promise<RunRecord['inputs'][number] | undefined> => {
  const relative = path.relative(ctx.root, file);
  const digestOf = await fingerprint(file);
  if (relative.startsWith('..') || path.isAbsolute(relative) || digestOf === null) {
    return undefined;
  }

  return { file: relative.split(path.sep).join('/'), digest: digestOf };
};

export interface OpenedRun {
  checked: CheckedPlan;
  paths: RunPaths;
  backedUp: number;
}

export const readPlanFile = async (file: string): Promise<RunPlan> => {
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

  if (!isRunPlan(parsed)) {
    throw new RunRefusal(
      'invalid',
      `${file} is not a plan: { version: 1, runId, goal, tasks: [{ id, title, files, dependsOn, priority, estimateMinutes, acceptance }] }`
    );
  }

  return parsed;
};

/** `plitzi run plan`: the plan held to the rules, expanded and estimated — nothing written. */
export const checkPlanFile = async (ctx: RunContext, file: string): Promise<CheckedPlan> => {
  await assertNoOtherRun(ctx);

  return (await readCheckedPlan(ctx.root, file)).checked;
};

/** A plan file read and checked against the project as it is, with the ownership it was checked by — no run touched. */
/** A primer is read whole by every agent: past this it no longer saves what it is for. */
export const MAX_PRIMER_BYTES = 16 * 1024;

/** The plan's primer, read beside the plan — refused, saying why, when it is not there or too long to be one. */
export const readPrimer = async (plan: RunPlan, planFile: string): Promise<string | undefined> => {
  if (plan.primer === undefined) {
    return undefined;
  }

  const file = path.resolve(path.dirname(planFile), plan.primer);
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

export const readCheckedPlan = async (
  root: string,
  file: string
): Promise<{ checked: CheckedPlan; ownership: Ownership; team: Team }> => {
  const plan = await readPlanFile(file);
  await readPrimer(plan, file);
  const ownership = await readOwnership(root);
  // The team works the run, and says how many at once: a project's first run writes the one its plan needs.
  const { team, created } = await ensureTeam(root, plan);
  try {
    const checked = await checkPlan(root, plan, ownership, team);

    return {
      checked: created ? { ...checked, notices: [created, ...checked.notices] } : checked,
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
  { leadFinishes = false }: { leadFinishes?: boolean } = {}
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
    await writeJson(taskFiles.state, {
      status: task.dependsOn.length === 0 ? 'ready' : 'pending',
      round: 0,
      notes: [],
      updatedAt: at
    } satisfies TaskState);
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
    ...(reviewsDesign(team, plan) ? { designReview: true as const } : {}),
    brake: [],
    merges: [],
    inputs: [await inputOf(ctx, path.resolve(file))].filter(input => input !== undefined)
  };
  // The plan as its lead wrote it, last: a folder with a plan and a record is a run.
  await writeJson(paths.plan, plan);
  await writeJson(paths.record, record);
  // The notes the plan carries are the run's memory from its first take on.
  const opened = await loadRun(ctx, plan.runId);
  for (const text of plan.notes ?? []) {
    await sendMessage(ctx, opened, { from: LEAD, to: EVERYONE, text });
  }

  await logRun(ctx, paths, { action: 'open', tasks: checked.tasks.length, backedUp: touched.length });

  return { checked, paths, backedUp: touched.length };
};

/** Counts toward the automatic brake; past it, the run stops as a stop does, and says why. */
export const recordBrake = async (
  ctx: RunContext,
  loaded: LoadedRun,
  kind: BrakeEvent['kind']
): Promise<string | undefined> => {
  let braked: string | undefined;
  await updateRecord(ctx, loaded.paths, record => {
    const since = ctx.now().getTime() - DEFAULTS.brakeWindowMs;
    const brake = [...record.brake, { kind, at: ctx.now().toISOString() }].filter(
      event => Date.parse(event.at) >= since
    );
    const failures = brake.filter(event => event.kind === 'checks-failed' || event.kind === 'conflict').length;
    const refused = brake.filter(event => event.kind === 'refused').length;
    const completes = brake.filter(event => event.kind === 'completed').length;
    if (record.status === 'open' && failures > DEFAULTS.brakeFailures) {
      braked = `${String(failures)} failed checks or conflicts within 30 minutes`;
    } else if (
      record.status === 'open' &&
      completes + refused >= DEFAULTS.brakeMinSample &&
      refused / (completes + refused) > DEFAULTS.brakeRefusedShare
    ) {
      braked = `${String(refused)} of ${String(completes + refused)} completions refused within 30 minutes`;
    }

    return braked
      ? {
          ...record,
          brake,
          status: 'stopping',
          stopRequestedAt: ctx.now().toISOString(),
          stopReason: `the automatic brake: ${braked}`
        }
      : { ...record, brake };
  });
  // Every one, in the log: what the run's report counts, whatever the brake's window kept.
  await logRun(ctx, loaded.paths, { action: 'event', kind });
  if (braked) {
    await logRun(ctx, loaded.paths, { action: 'brake', reason: braked });
  }

  return braked;
};

/** `plitzi run stop`: the tasks in hand finish and go to review; none starts. `--force` is a person's: it cuts them now. */
export const stopRun = async (ctx: RunContext, runId: string, force: boolean): Promise<{ cut: string[] }> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping', 'stopped'], 'stop');
  if (!force) {
    requireNoTask(ctx, 'stop a run');
    await updateRecord(ctx, loaded.paths, record => ({
      ...record,
      status: 'stopping',
      stopRequestedAt: ctx.now().toISOString(),
      stopReason: `stopped by ${ctx.agent}`
    }));
    await logRun(ctx, loaded.paths, { action: 'stop' });

    return { cut: [] };
  }

  await requirePerson(ctx, runId, 'force a stop, discarding what the tasks in hand wrote since their last review');
  await updateRecord(ctx, loaded.paths, record => ({
    ...record,
    status: 'stopped',
    forcedStopAt: ctx.now().toISOString(),
    stopReason: `stopped at once by ${ctx.agent}`
  }));
  const cut: string[] = [];
  for (const task of loaded.tasks) {
    const view = await viewTask(loaded.paths, task);
    // Only what is being written is cut: a task in review is finished work waiting for the lead, a blocked one waits
    // for an answer — neither has an agent writing, and cutting them would only throw finished work away.
    const writing = ['in-progress', 'changes-requested', 'waiting'].includes(view.state.status);
    if (view.owner && writing) {
      await cutTask(view, 'the run was stopped by force', ctx.now);
      cut.push(task.id);
    }
  }

  await logRun(ctx, loaded.paths, { action: 'stop', force: true, cut });

  return { cut };
};

/** `plitzi run resume`: a stopped or stopping run open again. */
export const resumeRun = async (ctx: RunContext, runId: string): Promise<void> => {
  requireNoTask(ctx, 'resume a run');
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['stopping', 'stopped'], 'resume');
  // What made it stop is weighed and done with: the brake judges what happens from here, not again what it saw.
  const was = loaded.record.stopReason;
  await updateRecord(ctx, loaded.paths, record => ({
    ...record,
    status: 'open',
    stopRequestedAt: undefined,
    stopReason: undefined,
    forcedStopAt: undefined,
    brake: []
  }));
  await logRun(ctx, loaded.paths, { action: 'resume', ...(was ? { after: was } : {}) });
};

/**
 * `plitzi run attach`: a lead, or a person, picks a run up — after the harness died, on another machine, or
 * after an upgrade. Tasks whose copy is gone (purged, or another machine's) start again from their reviewed version;
 * done tasks are never repeated. Another machine's run, or a changed version, is a person's to take.
 */
export const attachRun = async (
  ctx: RunContext,
  runId: string,
  takeOver: boolean
): Promise<{ cut: string[]; repinned: boolean; tookOver: boolean }> => {
  requireNoTask(ctx, 'attach to a run');
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  const elsewhere = loaded.record.activeOn.machine !== '' && loaded.record.activeOn.machine !== ctx.machine;
  if (elsewhere && !takeOver) {
    throw new RunRefusal(
      'other-machine',
      `Run "${runId}" is active on ${loaded.record.activeOn.machine}: release it there (plitzi run release ${runId}), or a person takes it over here (--take-over)`,
      { run: runId, holder: loaded.record.activeOn.machine }
    );
  }

  const pinned = await pinnedNow(ctx.root, ctx.cli);
  const repinned = !samePinned(loaded.record.pinned, pinned);
  if (elsewhere || repinned) {
    await requirePerson(
      ctx,
      runId,
      elsewhere
        ? `take run "${runId}" over from ${loaded.record.activeOn.machine}`
        : `re-pin run "${runId}" to the Plitzi installed now`
    );
  }

  const cut: string[] = [];
  for (const task of loaded.tasks) {
    const view = await viewTask(loaded.paths, task);
    const copyGone = !(await fs.stat(view.paths.work).catch(() => undefined));
    if (view.owner && view.state.status !== 'done' && (copyGone || elsewhere || repinned)) {
      await cutTask(view, copyGone ? 'its copy was purged' : 'the run was attached to again', ctx.now);
      cut.push(task.id);
    }
  }

  await fs.rm(loaded.paths.materialised, { recursive: true, force: true });
  const at = ctx.now().toISOString();
  await updateRecord(ctx, loaded.paths, record => ({
    ...record,
    activeOn: { machine: ctx.machine, since: at },
    pinned
  }));
  await logRun(ctx, loaded.paths, { action: 'attach', cut, repinned, tookOver: elsewhere });

  return { cut, repinned, tookOver: elsewhere };
};

/** `plitzi run release`: this machine lets the run go, so another can attach to it. */
export const releaseRun = async (ctx: RunContext, runId: string): Promise<void> => {
  requireNoTask(ctx, 'release a run');
  const loaded = await loadRun(ctx, runId);
  await updateRecord(ctx, loaded.paths, record => ({
    ...record,
    activeOn: { machine: '', since: ctx.now().toISOString() }
  }));
  await logRun(ctx, loaded.paths, { action: 'release' });
};

/** `plitzi run purge`: the run's folder, gone — its backups too, so a person's. */
export const purgeRun = async (ctx: RunContext, runId: string): Promise<RemovedInputs> => {
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  await requirePerson(ctx, runId, `purge run "${runId}" — its backups and its agents' work go with it`);

  return removeRun(ctx, loaded.paths, runId);
};

/** The newest write anywhere in a run's folder, but its caches: when it was last active. */
const lastActivity = async (paths: RunPaths): Promise<number> => {
  let newest = 0;
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'blobs') {
          await walk(full);
        }

        continue;
      }

      const stat = await fs.stat(full).catch(() => undefined);
      newest = Math.max(newest, stat?.mtimeMs ?? 0);
    }
  };
  await walk(paths.dir);

  return newest;
};

export interface Pruned {
  run: string;
  freed: number;
  why: string;
}

const cachesOf = async (paths: RunPaths): Promise<string[]> => [
  paths.cache,
  ...(await readTasks(paths)).map(task => taskPaths(paths, task.id).cache)
];

/**
 * `plitzi run prune`: the caches of runs idle for 8 hours removed, and the oldest beyond the size cap — never an
 * essential, so every run pruned can still be attached to, resumed and undone.
 */
export const pruneRuns = async (ctx: RunContext): Promise<Pruned[]> => {
  const pruned: Pruned[] = [];
  const kept: { run: string; activity: number; size: number; caches: string[] }[] = [];
  for (const runId of await runIds(ctx.root)) {
    const paths = runPaths(ctx.root, runId);
    const record = await readRecord(paths).catch(() => undefined);
    if (!record) {
      continue;
    }

    const caches = await cachesOf(paths);
    let size = 0;
    for (const cache of caches) {
      size += await sizeOf(cache);
    }

    if (size === 0) {
      continue;
    }

    const activity = await lastActivity(paths);
    if (ctx.now().getTime() - activity > DEFAULTS.cacheIdleMs) {
      for (const cache of caches) {
        await fs.rm(cache, { recursive: true, force: true });
      }

      pruned.push({ run: runId, freed: size, why: 'idle for more than 8 hours' });
    } else {
      kept.push({ run: runId, activity, size, caches });
    }
  }

  let total = kept.reduce((sum, run) => sum + run.size, 0);
  // A run with a task alive in it is never pruned for size: only those quiet for longer than a task may go without a signal.
  const quiet = kept.filter(run => ctx.now().getTime() - run.activity > DEFAULTS.noSignalMs);
  for (const run of quiet.sort((a, b) => a.activity - b.activity)) {
    if (total <= DEFAULTS.cacheCapBytes) {
      break;
    }

    for (const cache of run.caches) {
      await fs.rm(cache, { recursive: true, force: true });
    }

    total -= run.size;
    pruned.push({ run: run.run, freed: run.size, why: 'the runs’ caches were above 1 GB; the oldest go first' });
  }

  return pruned;
};

/**
 * `plitzi run allow-finish`: a person lets the lead of an open run write it into the project itself — or, `--revoke`,
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
