import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { readJson, readOptional, writeJson } from '../files';
import { isApprovedManifest, isBaseManifest, isRunPlan, isRunRecord, isSharedManifest } from '../model';
import { ID, runPaths, runsDir } from '../paths';
import { RunRefusal } from '../refusal';
import { withLock } from '../store';
import { appendLog, readTasks } from '../taskStore';

import type { ApprovedManifest, BaseManifest, Pinned, RunRecord, SharedManifest } from '../model';
import type { RunPaths } from '../paths';
import type { LoadedRun, RunContext } from './context';

/**
 * A run's record and manifests, read and written under its lock: loaded with the versions it was pinned to, its
 * status held to what an action needs, its log.
 */

/** What the run pins: this CLI, and every `@plitzi/*` package the project has installed. */
export const pinnedNow = async (root: string, cli: string): Promise<Pinned> => {
  const scope = path.join(root, 'node_modules', '@plitzi');
  const names = await fs.readdir(scope).catch(() => []);
  const packages: Record<string, string> = {};
  // A name with a dot first is npm's, never a package: the folder it stages one in while it installs (`.cli-4Vu260qW`)
  // — read then, the run was told Plitzi changed under it, every package "none", and its agents stopped.
  for (const name of names.filter(each => !each.startsWith('.')).sort()) {
    const bytes = await readOptional(path.join(scope, name, 'package.json'));
    if (bytes === undefined) {
      continue;
    }

    let manifest: unknown;
    try {
      manifest = JSON.parse(bytes.toString('utf-8'));
    } catch {
      // Half written, as an install writes it: no version to pin yet.
      continue;
    }

    if (isRecord(manifest) && typeof manifest.version === 'string') {
      packages[`@plitzi/${name}`] = manifest.version;
    }
  }

  return { cli, packages };
};

export const samePinned = (a: Pinned, b: Pinned): boolean => JSON.stringify(a) === JSON.stringify(b);

/** What changed between two pins, a line each: `@plitzi/cli 0.38.1 → 0.38.2`. */
export const pinnedChanges = (was: Pinned, now: Pinned): string[] => {
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

/** The run's activity, every line it wrote, oldest first — one a line it cannot read is passed over, never a crash. */
export const readRunLog = async (paths: RunPaths): Promise<Record<string, unknown>[]> => {
  const text = (await readOptional(paths.log))?.toString('utf-8') ?? '';

  return text.split('\n').flatMap(line => {
    if (line.trim() === '') {
      return [];
    }

    try {
      const parsed: unknown = JSON.parse(line);

      return isRecord(parsed) ? [parsed] : [];
    } catch {
      return [];
    }
  });
};

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
