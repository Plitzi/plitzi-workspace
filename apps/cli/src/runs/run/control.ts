import fs from 'node:fs/promises';
import path from 'node:path';

import { requirePerson, requirePrincipal } from './context';
import {
  assertStatus,
  loadRun,
  logRun,
  pinnedChanges,
  pinnedNow,
  readRecord,
  readRunLog,
  runIds,
  samePinned,
  updateRecord
} from './record';
import { isBrakeKind } from '../agents/brake';
import { agentsNow } from '../agents/running';
import { readTeam } from '../agents/team';
import { sizeOf } from '../core/files';
import { runPaths, taskPaths } from '../core/paths';
import { RunRefusal } from '../core/refusal';
import { brakeFailuresFor, cutTask, DEFAULTS, readTasks, viewTask } from '../core/taskStore';
import { LEAD, sendMessage } from '../talk/messages';

import type { LoadedRun, RunContext } from './context';
import type { BrakeEvent } from '../agents/brake';
import type { RunRecord } from '../core/model';
import type { RunPaths } from '../core/paths';

/**
 * A run once open: its brake, stopped and resumed, attached on another machine or version, released, purged, and
 * pruned when its caches are left behind.
 */

/**
 * Every completion a run saw, by how it ended: its record's — or, for a run an older CLI opened, what that CLI wrote of
 * them in the log as `event` lines, where they were kept before the record held them.
 */
export const completionsOf = (
  record: RunRecord,
  log: readonly { action?: unknown; kind?: unknown }[]
): Record<BrakeEvent['kind'], number> => {
  if (record.completions) {
    return record.completions;
  }

  const counted = { completed: 0, refused: 0, 'checks-failed': 0, conflict: 0 };
  for (const entry of log) {
    if (entry.action === 'event' && isBrakeKind(entry.kind)) {
      counted[entry.kind] += 1;
    }
  }

  return counted;
};

/** Counts toward the automatic brake; past it, the run stops as a stop does, and says why. */
export const recordBrake = async (
  ctx: RunContext,
  loaded: LoadedRun,
  kind: BrakeEvent['kind'],
  /** The task it is about: the run's activity says which, not only that something failed. */
  task?: string
): Promise<string | undefined> => {
  let braked: string | undefined;
  const log = loaded.record.completions ? [] : await readRunLog(loaded.paths);
  await updateRecord(ctx, loaded.paths, record => {
    const since = ctx.now().getTime() - DEFAULTS.brakeWindowMs;
    const brake = [...record.brake, { kind, at: ctx.now().toISOString() }].filter(
      event => Date.parse(event.at) >= since
    );
    const was = completionsOf(record, log);
    const completions = { ...was, [kind]: was[kind] + 1 };
    const failures = brake.filter(event => event.kind === 'checks-failed' || event.kind === 'conflict').length;
    const refused = brake.filter(event => event.kind === 'refused').length;
    const completes = brake.filter(event => event.kind === 'completed').length;
    if (record.status === 'open' && failures > brakeFailuresFor(record.agents)) {
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
          completions,
          status: 'stopping',
          stopRequestedAt: ctx.now().toISOString(),
          stopReason: `the automatic brake: ${braked}`
        }
      : { ...record, brake, completions };
  });
  if (braked) {
    await logRun(ctx, loaded.paths, { action: 'brake', reason: braked, ...(task === undefined ? {} : { task }) });
  }

  return braked;
};

/** What a task being written is in: an agent at it — a task in review, or blocked, has none writing. */
const WRITING: readonly string[] = ['in-progress', 'changes-requested', 'waiting'];

/**
 * The tasks an agent is writing now: what a gentle stop waits for (`run upgrade`). One whose agent is not running has
 * none writing it, its copy kept for when it starts again — a run's upgrade waited an hour on a task sent back to an
 * agent that had ended.
 */
export const writingTasks = async (ctx: RunContext, runId: string): Promise<string[]> => {
  const loaded = await loadRun(ctx, runId, { anyVersion: true });
  const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
  const team = await readTeam(ctx.root).catch(() => undefined);
  const { running } = await agentsNow(loaded.paths, views, team, await readRunLog(loaded.paths), ctx.now());

  return views
    .filter(view => view.owner && running.has(view.owner.agent) && WRITING.includes(view.state.status))
    .map(view => view.task.id);
};

/** `plitzi run stop`: the tasks in hand finish and go to review; none starts. `--force` is a person's: it cuts them now. */
export const stopRun = async (
  ctx: RunContext,
  runId: string,
  force: boolean,
  reason = `stopped by ${ctx.agent}`
): Promise<{ cut: string[] }> => {
  // Stopped whatever Plitzi is installed: a stop writes only the run's state, and `run upgrade` stops a run whose
  // version changed already to set it right — a run's was refused it, left stopping on a version it never re-pinned.
  const loaded = await loadRun(ctx, runId, { anyVersion: true });
  assertStatus(loaded, ['open', 'stopping', 'stopped'], 'stop');
  if (!force) {
    requirePrincipal(ctx, 'stop a run');
    await updateRecord(ctx, loaded.paths, record => ({
      ...record,
      status: 'stopping',
      stopRequestedAt: ctx.now().toISOString(),
      stopReason: reason
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
    const writing = WRITING.includes(view.state.status);
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
  requirePrincipal(ctx, 'resume a run');
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
 * done tasks are never repeated. After an upgrade on this machine a task in hand keeps its copy and its agent: its
 * work is source, and its next `complete` runs the checks with the Plitzi installed now — each is told so. Another
 * machine's run, or a changed version, is a person's to take.
 */
export const attachRun = async (
  ctx: RunContext,
  runId: string,
  takeOver: boolean
): Promise<{ cut: string[]; kept: string[]; repinned: boolean; tookOver: boolean }> => {
  requirePrincipal(ctx, 'attach to a run');
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  const elsewhere = loaded.record.activeOn.machine !== '' && loaded.record.activeOn.machine !== ctx.machine;
  if (elsewhere && !takeOver) {
    throw new RunRefusal(
      'other-machine',
      `Run "${runId}" is active on ${loaded.record.activeOn.machine}: release it there (plitzi run attach ${runId} --release), or a person takes it over here (plitzi run attach ${runId} --take-over)`,
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
  const kept: string[] = [];
  for (const task of loaded.tasks) {
    const view = await viewTask(loaded.paths, task);
    if (!view.owner || view.state.status === 'done') {
      continue;
    }

    const copyGone = !(await fs.stat(view.paths.work).catch(() => undefined));
    if (copyGone || elsewhere) {
      await cutTask(view, copyGone ? 'its copy was purged' : 'the run was attached to again', ctx.now);
      cut.push(task.id);
    } else if (repinned) {
      kept.push(task.id);
    }
  }

  await fs.rm(loaded.paths.materialised, { recursive: true, force: true });
  const at = ctx.now().toISOString();
  await updateRecord(ctx, loaded.paths, record => ({
    ...record,
    activeOn: { machine: ctx.machine, since: at },
    pinned
  }));
  const changes = pinnedChanges(loaded.record.pinned, pinned).join(', ');
  for (const taskId of kept) {
    await sendMessage(ctx, loaded, {
      from: LEAD,
      to: taskId,
      text: `The run is re-pinned to the Plitzi installed now (${changes}): your copy and your work are kept — go on; your next complete runs the checks with it, and a check that answers otherwise now is said there`
    });
  }

  await logRun(ctx, loaded.paths, { action: 'attach', cut, kept, repinned, tookOver: elsewhere });

  return { cut, kept, repinned, tookOver: elsewhere };
};

/** `plitzi run attach --release`: this machine lets the run go, so another can attach to it. */
export const releaseRun = async (ctx: RunContext, runId: string): Promise<void> => {
  requirePrincipal(ctx, 'release a run');
  const loaded = await loadRun(ctx, runId);
  await updateRecord(ctx, loaded.paths, record => ({
    ...record,
    activeOn: { machine: '', since: ctx.now().toISOString() }
  }));
  await logRun(ctx, loaded.paths, { action: 'release' });
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
 * The caches of runs idle for 8 hours removed — at every run's open and while a person watches, and the oldest beyond the size cap — never an
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
