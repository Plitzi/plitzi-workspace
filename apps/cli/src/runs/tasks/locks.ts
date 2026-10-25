import fs from 'node:fs/promises';

import { createExclusive, fingerprint, writeJson } from '../files';
import { entryOf } from '../model';
import { lockFile, runPaths, taskPaths, under } from '../paths';
import { RunRefusal } from '../refusal';
import { activeRuns, assertStatus, loadRun, readApproved, readShared, runIds } from '../run';
import { runChanged } from '../runChanged';
import { withLock } from '../store';
import {
  appendLog,
  DEFAULTS,
  lockedFiles,
  locksExpired,
  noSignalAfter,
  readStart,
  updateState,
  viewTask
} from '../taskStore';
import { PRIORITY_RANK } from '../urgency';
import { at, cleanPath, findTask, holderOf, refreshCopy } from './common';

import type { FileLock, RunTask, TaskState } from '../model';
import type { LoadedRun, RunContext } from '../run';

/**
 * A task's files while it works: who holds which (`.lock`s), a shared file claimed by turns, waited for, and handed on.
 */

export interface HeldFile {
  run: string;
  task: string;
  lock: FileLock;
  /** Whether the lock still holds: its task has a signal, or lost it less than the lock outlives it. */
  live: boolean;
  /** When the lock runs out if its holder gives no sign of life from now — not when the holder will be done. */
  until?: string;
}

/** Every `.lock` in every run of the project, live or run out, by the file it reserves — read once per command. */
export const allLocks = async (ctx: RunContext): Promise<Map<string, HeldFile[]>> => {
  const held = new Map<string, HeldFile[]>();
  for (const runId of await runIds(ctx.root)) {
    const paths = runPaths(ctx.root, runId);
    const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true }).catch(() => undefined);
    if (!loaded) {
      continue;
    }

    for (const task of loaded.tasks) {
      const locks = await lockedFiles(taskPaths(paths, task.id));
      if (locks.size === 0) {
        continue;
      }

      const view = await viewTask(paths, task);
      const live = !locksExpired(task, view.signalAt, ctx.now());
      const until =
        view.signalAt === undefined
          ? undefined
          : new Date(view.signalAt + noSignalAfter(task) + DEFAULTS.lockAfterSignalMs).toISOString();
      for (const [file, lock] of locks) {
        held.set(file, [
          ...(held.get(file) ?? []),
          { run: runId, task: task.id, lock, live, ...(until ? { until } : {}) }
        ]);
      }
    }
  }

  return held;
};

export const locksOn = async (ctx: RunContext, file: string): Promise<HeldFile[]> =>
  (await allLocks(ctx)).get(file) ?? [];

/** `plitzi run can-write`: whether `file` may be written by the caller — for any hook or editor to ask. */
export type CanWrite =
  | { ok: true; file: string; plannedFor?: { run: string; task: string } }
  | { ok: false; file: string; holder: HeldFile }
  | { ok: false; file: string; plannedFor: { run: string; task: string } };

/**
 * `plitzi run can-write`: whether `file` may be written by the caller — for any hook or editor to ask. Held by a task's
 * lock, no. In the plan of a task not taken yet: no for another task's agent — `complete` refuses it as that task's —
 * and yes for a person, said with the task that will take it.
 */
export const canWrite = async (ctx: RunContext, file: string, taskId?: string): Promise<CanWrite> => {
  const clean = cleanPath(ctx.root, file);
  const holder = (await locksOn(ctx, clean)).find(held => held.live && held.task !== taskId);
  if (holder) {
    return { ok: false, file: clean, holder };
  }

  for (const run of await activeRuns(ctx.root)) {
    const planned = await activeHolder(await loadRun(ctx, run, { anyMachine: true, anyVersion: true }), clean);
    if (planned && planned.id !== taskId) {
      const plannedFor = { run, task: planned.id };

      return taskId === undefined ? { ok: true, file: clean, plannedFor } : { ok: false, file: clean, plannedFor };
    }
  }

  return { ok: true, file: clean };
};

/** `plitzi task claims`: every live `.lock` of a run, by file. */
export const claims = async (
  ctx: RunContext,
  runId: string
): Promise<{ file: string; lock: FileLock; live: boolean }[]> => {
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  const found: { file: string; lock: FileLock; live: boolean }[] = [];
  for (const task of loaded.tasks) {
    const view = await viewTask(loaded.paths, task);
    for (const [file, lock] of await lockedFiles(view.paths)) {
      found.push({ file, lock, live: !locksExpired(task, view.signalAt, ctx.now()) });
    }
  }

  return found.sort((a, b) => a.file.localeCompare(b.file));
};

/** What the run shares: what was found shared when it opened, and the project's entries. */
export const sharedFiles = async (loaded: LoadedRun): Promise<Set<string>> =>
  new Set((await readShared(loaded.paths)).files.map(file => file.file));

export interface ClaimOutcome {
  file: string;
  granted: boolean;
  /** Not granted: whether to wait (one task ahead at most) or to change it in the copy as a request. */
  turn?: 'wait' | 'request';
  holder?: string;
}

/** Whether `task` waits, through its `dependsOn` and theirs, for the task `on`. */
const waitsFor = (loaded: LoadedRun, task: RunTask, on: string, seen = new Set<string>()): boolean =>
  task.dependsOn.some(id => {
    if (id === on) {
      return true;
    }

    if (seen.has(id)) {
      return false;
    }

    seen.add(id);
    const before = loaded.tasks.find(each => each.id === id);

    return before !== undefined && waitsFor(loaded, before, on, seen);
  });

/**
 * The task whose plan names `file` while it is not done: once done, it holds nothing — its files are taken by turns,
 * and a shared one is requested like any other. An integration task is never one: the shared file it applies requests
 * to stays shared, held by its lock only while it is worked — until then, taken by turns or requested like any other.
 * Nor, for the task asking (`asker`), is one that waits for it: it takes the file after, and holding it meanwhile left
 * both waiting for ever (a stacked task after t-follow-api named the file t-follow-api created).
 */
export const activeHolder = async (loaded: LoadedRun, file: string, asker?: RunTask): Promise<RunTask | undefined> => {
  const planned = loaded.tasks.find(
    task =>
      task.kind !== 'integration' &&
      task.files.includes(file) &&
      (asker === undefined || task.id === asker.id || !waitsFor(loaded, task, asker.id))
  );

  return planned && (await viewTask(loaded.paths, planned)).state.status !== 'done' ? planned : undefined;
};

/** `plitzi task claim`: a file outside the task's own — a shared one — taken by turns. */
export const claimFile = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  file: string
): Promise<ClaimOutcome> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'claim a file');
  const task = findTask(loaded, taskId);
  const view = await holderOf(ctx, loaded, task);
  const clean = cleanPath(ctx.root, file);
  if (task.files.includes(clean)) {
    return { file: clean, granted: true };
  }

  const planned = await activeHolder(loaded, clean, task);
  if (planned) {
    throw new RunRefusal('claimed', `${clean} is task "${planned.id}"'s: wait for it (plitzi task wait)`, {
      file: clean,
      holder: planned.id,
      turn: 'wait'
    });
  }

  /** Who holds it otherwise, said with the turn: wait for it, or request the change through an integration. */
  const refuseHeld = async (holder: Awaited<ReturnType<typeof locksOn>>[number]): Promise<never> => {
    const views = await Promise.all(loaded.tasks.map(each => viewTask(loaded.paths, each)));
    const queued = views.filter(each => each.state.waitingFor?.file === clean).length;
    const turn = queued === 0 ? 'wait' : 'request';
    const mine = holder.run === runId && holder.lock.agent === (view.owner?.agent ?? ctx.agent);
    throw new RunRefusal(
      'claimed',
      mine
        ? `${clean} is held by "${holder.task}", your own other task: it is yours to change there — finish that one and its turn passes here (plitzi task wait ${clean})`
        : turn === 'wait'
          ? `${clean} is held by task "${holder.task}" by turns (turn: wait): wait for it (plitzi task wait ${clean}) and go on with the rest of your task meanwhile`
          : `${clean} is held by task "${holder.task}", and ${String(queued)} more wait for it (turn: request): change it in your copy and say why (plitzi task request ${clean} --summary …) — your change goes in through one integration task that applies every request together`,
      { file: clean, holder: holder.task, turn, ...(holder.until ? { until: holder.until } : {}) }
    );
  };

  const lock: FileLock = {
    runId,
    taskId,
    agent: view.owner?.agent ?? ctx.agent,
    intent: `by turns, for ${task.title}`,
    since: at(ctx),
    kind: 'turn'
  };
  const created = await withLock(
    loaded.paths.claimLock,
    async () => {
      const holder = (await locksOn(ctx, clean)).find(
        held => held.live && !(held.run === runId && held.task === taskId)
      );
      if (holder) {
        await refuseHeld(holder);
      }

      return createExclusive(lockFile(view.paths, clean), `${JSON.stringify(lock, null, 2)}\n`);
    },
    { now: ctx.now }
  );
  if (!created) {
    return { file: clean, granted: true };
  }

  const start = await readStart(view.paths);
  const inCopy = await fingerprint(under(view.paths.work, clean));
  if (start && inCopy === (start.files[clean] ?? null)) {
    await refreshCopy(ctx, loaded, view, clean);
  }

  await appendLog(view.paths.log, { at: at(ctx), by: ctx.agent, action: 'claim', file: clean });

  return { file: clean, granted: true };
};

/** Hands a file let go of to the task waiting for it with the highest priority: its lock, and the run's version. */
export const grantWaiters = async (ctx: RunContext, loaded: LoadedRun, files: readonly string[]): Promise<string[]> => {
  const granted: string[] = [];
  const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
  for (const file of files) {
    const waiting = views
      .filter(view => view.state.status === 'waiting' && view.state.waitingFor?.file === file && view.owner)
      .sort(
        (a, b) =>
          PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority] ||
          Date.parse(a.state.waitingFor?.since ?? '') - Date.parse(b.state.waitingFor?.since ?? '')
      );
    const next = waiting.at(0);
    if (!next) {
      continue;
    }

    const lock: FileLock = {
      runId: loaded.record.runId,
      taskId: next.task.id,
      agent: next.owner?.agent ?? 'agent',
      intent: `by turns, for ${next.task.title}`,
      since: at(ctx),
      kind: 'turn'
    };
    // Under the claim lock: a task that took the file by turns since it was let go keeps it, and this one waits on.
    const handed = await withLock(
      loaded.paths.claimLock,
      async () => {
        const holder = (await locksOn(ctx, file)).find(
          held => held.live && !(held.run === loaded.record.runId && held.task === next.task.id)
        );
        if (holder) {
          return false;
        }

        await writeJson(lockFile(next.paths, file), lock);

        return true;
      },
      { now: ctx.now }
    );
    if (!handed) {
      continue;
    }

    const start = await readStart(next.paths);
    const inCopy = await fingerprint(under(next.paths.work, file));
    const untouched = start !== undefined && inCopy === (start.files[file] ?? null);
    // The copy is brought up to the run: the file, if the task left it alone, and what was approved since it was made.
    const brought = await refreshCopy(ctx, loaded, next);
    const also = brought.filter(each => each !== file);

    await updateState(
      next.paths,
      state => ({
        ...state,
        status: state.round > 0 ? 'changes-requested' : 'in-progress',
        waitingFor: undefined,
        notes: [
          ...state.notes,
          {
            at: at(ctx),
            by: 'plitzi',
            text: `${
              untouched
                ? `${file} is yours now, with the version approved in the run`
                : `${file} is yours now; your copy had changed it, so the approved version was not put in: compare them (plitzi task discard ${file} takes the run's)`
            }${also.length > 0 ? `. Brought into your copy, approved since it was made: ${also.join(', ')}` : ''}`
          }
        ]
      }),
      ctx.now
    );
    granted.push(`${file} → ${next.task.id}`);
  }

  return granted;
};

/** `plitzi task release`: a file held by turns let go, to the next task waiting for it. */
export const releaseFile = async (ctx: RunContext, runId: string, taskId: string, file: string): Promise<string[]> => {
  const loaded = await loadRun(ctx, runId);
  const task = findTask(loaded, taskId);
  const view = await holderOf(ctx, loaded, task);
  const clean = cleanPath(ctx.root, file);
  const lock = (await lockedFiles(view.paths)).get(clean);
  if (!lock) {
    throw new RunRefusal('invalid', `Task "${taskId}" holds no lock on ${clean}`, { file: clean });
  }

  if (lock.kind === 'own') {
    throw new RunRefusal('invalid', `${clean} is task "${taskId}"'s own: it is let go when the task is approved`, {
      file: clean
    });
  }

  await fs.rm(lockFile(view.paths, clean), { force: true });
  await appendLog(view.paths.log, { at: at(ctx), by: ctx.agent, action: 'release', file: clean });

  return grantWaiters(ctx, loaded, [clean]);
};

/** The task holding `file` now: its lock's, or the plan's while that task is not done. */
const holderTaskOf = async (
  ctx: RunContext,
  loaded: LoadedRun,
  file: string,
  except: string
): Promise<string | undefined> => {
  const lock = (await locksOn(ctx, file)).find(
    held => held.live && held.run === loaded.record.runId && held.task !== except
  );
  if (lock) {
    return lock.task;
  }

  const planned = await activeHolder(loaded, file);
  if (planned && planned.id !== except) {
    return planned.id;
  }

  return undefined;
};

/** Refuses the wait of `taskId` on `holder` that would close a cycle — a file or an answer, all the same — naming it. */
/** The tasks that run only after `taskId`: those whose `dependsOn` names it, or names one of them. */
const runsAfter = (loaded: LoadedRun, taskId: string): Set<string> => {
  const after = new Set<string>();
  for (let grew = true; grew;) {
    grew = false;
    for (const each of loaded.plan.tasks) {
      if (!after.has(each.id) && each.dependsOn.some(id => id === taskId || after.has(id))) {
        after.add(each.id);
        grew = true;
      }
    }
  }

  return after;
};

export const assertNoWaitCycle = async (loaded: LoadedRun, taskId: string, holder: string): Promise<void> => {
  // A task that runs only after this one hands nothing on before this one is approved: the wait would never end, and the
  // agent's harness gave up on it first (a run's dev-1, at t-moderation-demo).
  if (runsAfter(loaded, taskId).has(holder)) {
    throw new RunRefusal(
      'invalid',
      `${holder} runs after ${taskId} (its dependsOn leads to it): what it hands on comes only once ${taskId} is approved, so this wait would never end. Go on without it, or tell the lead (plitzi task tell "…")`,
      { task: holder }
    );
  }

  const views = new Map(
    await Promise.all(loaded.tasks.map(async each => [each.id, await viewTask(loaded.paths, each)] as const))
  );
  const chain = [taskId, holder];
  let current = views.get(holder)?.state.waitingFor?.task;
  while (current !== undefined) {
    chain.push(current);
    if (current === taskId) {
      throw new RunRefusal('invalid', `Waiting would close a cycle: ${chain.join(' waits for ')} — the lead decides`, {
        cycle: chain
      });
    }

    current = views.get(current)?.state.waitingFor?.task;
  }
};

/**
 * `plitzi task wait`: the task waits for a file another holds, instead of being replanned. The wait that would close a
 * cycle (A waits for B, B for A) is refused, naming it.
 */
export const waitForFile = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  file: string
): Promise<{ file: string; holder?: string; granted?: true; nowhere?: true }> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'wait for a file');
  const task = findTask(loaded, taskId);
  const view = await holderOf(ctx, loaded, task);
  const clean = cleanPath(ctx.root, file);
  const holder = await holderTaskOf(ctx, loaded, clean, taskId);
  // Let go of before the wait came — its holder approved meanwhile: nothing to wait for, it is taken by turns now.
  if (!holder) {
    await claimFile(ctx, runId, taskId, clean);
    // Held by nobody and in neither the project nor the run's work: another task may be making it, outside its plan's
    // files — said, as granting it alone read as "it is there" (t-close-home waited for topStyles.ts, which
    // only t-home-top's copy had).
    const nowhere =
      entryOf((await readApproved(loaded.paths)).files, clean) === undefined &&
      (await fingerprint(under(ctx.root, clean))) === null;

    return { file: clean, granted: true, ...(nowhere ? { nowhere: true as const } : {}) };
  }

  await assertNoWaitCycle(loaded, taskId, holder);
  await updateState(
    view.paths,
    state => ({
      ...state,
      status: 'waiting',
      waitingFor: { file: clean, task: holder, since: at(ctx) },
      notes: [...state.notes, { at: at(ctx), by: ctx.agent, text: `Waits for ${holder} on ${clean}` }]
    }),
    ctx.now
  );

  return { file: clean, holder };
};

export interface Followed {
  /** Whether what it waited for came: the file is its, or its proposal was answered. */
  done: boolean;
  state: TaskState;
  /** What it was told when it came — the task's latest note. */
  note?: string;
}

/**
 * `--follow` on a wait: stays until what the task waits for comes — a file handed on, an answer — giving its sign of
 * life meanwhile, so a long wait never costs it the task. Ends, said, at `timeoutMs`, or when the run stops or the task
 * is no longer the caller's.
 */
export const followWait = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  { timeoutMs = 30 * 60_000, everyMs = 15_000 }: { timeoutMs?: number; everyMs?: number } = {}
): Promise<Followed> => {
  const started = Date.now();
  for (;;) {
    const loaded = await loadRun(ctx, runId);
    const view = await holderOf(ctx, loaded, findTask(loaded, taskId));
    if (view.state.status !== 'waiting') {
      return {
        done: true,
        state: view.state,
        ...(view.state.notes.at(-1) ? { note: view.state.notes.at(-1)?.text } : {})
      };
    }

    if (Date.now() - started >= timeoutMs) {
      return { done: false, state: view.state };
    }

    await writeJson(view.paths.progress, { ...(view.progress ?? {}), heartbeatAt: at(ctx) });
    await runChanged(runPaths(ctx.root, runId).dir, everyMs);
  }
};
