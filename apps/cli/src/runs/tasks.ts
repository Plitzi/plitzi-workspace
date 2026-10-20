import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { durationText } from '../options';
import { checkAcceptance } from './acceptance';
import { agreementsOf, proposalsOf, unansweredTo } from './agreements';
import { failsWithout } from './checks';
import {
  cloneFiles,
  createExclusive,
  fingerprint,
  isCopied,
  projectFiles,
  readOptional,
  writeAtomic,
  writeJson
} from './files';
import { checkVersions } from './materialise';
import { mergeLines } from './merge3';
import { agentAddress, LEAD, messagesOf, runNotesOf, sendMessage, unreadFor, unreadForHolder } from './messages';
import { entryOf } from './model';
import { COPY_TASK_FILE, ID, lockFile, projectPath, runPaths, taskPaths, under } from './paths';
import { dependenciesDone, PRIORITY_RANK, readyTasks } from './plan';
import { syncPreview } from './preview';
import { isRunRefusal, RunRefusal } from './refusal';
import {
  assertStatus,
  loadRun,
  logRun,
  readApproved,
  readBase,
  readShared,
  recordBrake,
  requireNoTask,
  requirePerson,
  runIds
} from './run';
import { getBlob, keepFiles, placeVersion, putBlob, withLock } from './store';
import {
  appendLog,
  cutTask,
  DEFAULTS,
  isDisconnected,
  lockedFiles,
  locksExpired,
  noSignalAfter,
  readOwner,
  readRequests,
  readStart,
  requestId,
  revokeOwner,
  updateState,
  viewTask,
  writeRequest
} from './taskStore';
import { unifiedDiff } from '../fix/diff';
import { PROJECT_NOTES } from '../scaffold/paths';

import type { ProposalView } from './agreements';
import type { CheckResult } from './checks';
import type { Message } from './messages';
import type {
  ApprovedFile,
  ApprovedManifest,
  FileLock,
  Needs,
  ProjectChange,
  ReviewComment,
  RunTask,
  SharedRequest,
  TaskStart,
  TaskState
} from './model';
import type { LoadedRun, RunContext } from './run';
import type { TaskView } from './taskStore';

/**
 * What a task does in a run (RFC 0028 §9): taken with an exclusive owner, a `.lock` per file and a copy of the
 * project; written only in that copy; completed with its fingerprints compared and the project's checks run in it;
 * reviewed; and, approved, merged into the run's work — never into the project, which only the final merge reaches.
 */

const at = (ctx: RunContext): string => ctx.now().toISOString();

export const findTask = (loaded: LoadedRun, taskId: string): RunTask => {
  const task = loaded.tasks.find(each => each.id === taskId);
  if (!task) {
    throw new RunRefusal('not-found', `Run "${loaded.record.runId}" has no task "${taskId}"`, {
      task: taskId,
      tasks: loaded.tasks.map(each => each.id)
    });
  }

  return task;
};

export const cleanPath = (root: string, file: string): string => {
  const clean = projectPath(root, file);
  if (clean.startsWith('..') || clean === '') {
    throw new RunRefusal('invalid', `${file} is not a file of the project`);
  }

  return clean;
};

/** The task the caller's token holds: refused, saying why, for a token that is not this task's any more. */
export const holderOf = async (ctx: RunContext, loaded: LoadedRun, task: RunTask): Promise<TaskView> => {
  const view = await viewTask(loaded.paths, task);
  if (ctx.token === undefined) {
    throw new RunRefusal(
      'invalid',
      `This is the command of whoever holds task "${task.id}": pass its token (--token, or PLITZI_TASK_TOKEN)`,
      { task: task.id }
    );
  }

  // Approved, the task is over and its token with it: said as that, not as a task taken away.
  if (view.state.status === 'done') {
    throw new RunRefusal(
      'invalid',
      `Task "${task.id}" is done — approved: its token closed with it. What was said on it: plitzi task show ${task.id} (the lead's)`,
      { task: task.id, next: 'take the next one: plitzi task next' }
    );
  }

  if (!view.owner || view.owner.token !== ctx.token) {
    const forced = loaded.record.forcedStopAt !== undefined && loaded.record.status === 'stopped';
    throw new RunRefusal(
      forced ? 'forced-stop' : 'reassigned',
      forced
        ? `Run "${loaded.record.runId}" was stopped by force: task "${task.id}" is no longer yours`
        : `Task "${task.id}" is no longer yours: it was reassigned or cut${view.owner ? `, and ${view.owner.agent} holds it now` : ''}`,
      { task: task.id, ...(view.owner ? { holder: view.owner.agent } : {}) }
    );
  }

  return view;
};

/** The holder, or the lead or a person (no token): who may note, block or report on a task. */
export const holderOrCoordinator = async (ctx: RunContext, loaded: LoadedRun, task: RunTask): Promise<TaskView> =>
  ctx.token === undefined ? viewTask(loaded.paths, task) : holderOf(ctx, loaded, task);

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
export const canWrite = async (
  ctx: RunContext,
  file: string,
  taskId?: string
): Promise<{ ok: true; file: string } | { ok: false; file: string; holder: HeldFile }> => {
  const clean = cleanPath(ctx.root, file);
  const holder = (await locksOn(ctx, clean)).find(held => held.live && held.task !== taskId);

  return holder ? { ok: false, file: clean, holder } : { ok: true, file: clean };
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

/** The run's version of a file now: its approved work over the project. */
const currentVersion = async (
  ctx: RunContext,
  approved: ApprovedManifest,
  file: string
): Promise<{ digest: string | null; fromProject: boolean }> => {
  const entry = entryOf(approved.files, file);
  if (entry) {
    return { digest: entry.digest, fromProject: false };
  }

  return { digest: await fingerprint(under(ctx.root, file)), fromProject: true };
};

/**
 * Brings a task's copy up to the run: every file the run approved since the copy was made — or that `file` names — put
 * in, unless the task changed it itself. A file handed on by turns arrives with what it imports, approved after the copy
 * was made. Answers what it brought.
 */
const refreshCopy = async (ctx: RunContext, loaded: LoadedRun, view: TaskView, file?: string): Promise<string[]> => {
  const approved = await readApproved(loaded.paths);
  const start = await readStart(view.paths);
  if (!start) {
    return [];
  }

  const files = { ...start.files };
  const overlaid = new Set(start.overlaid);
  const brought: string[] = [];
  const candidates = new Set([...Object.keys(approved.files), ...(file ? [file] : [])]);
  for (const each of candidates) {
    const inCopy = await fingerprint(under(view.paths.work, each));
    const startedFrom = files[each] ?? null;
    // The task's own change stays: only what it did not touch is brought, and `file` when it is asked for by name.
    if (each !== file && inCopy !== startedFrom) {
      continue;
    }

    const current = await currentVersion(ctx, approved, each);
    if (current.digest === inCopy && current.digest === startedFrom) {
      continue;
    }

    if (current.fromProject) {
      const bytes = await readOptional(under(ctx.root, each));
      if (bytes === undefined) {
        await fs.rm(under(view.paths.work, each), { force: true });
      } else {
        await placeVersion(loaded.paths, under(view.paths.work, each), await putBlob(loaded.paths, bytes));
      }

      overlaid.delete(each);
    } else {
      await placeVersion(loaded.paths, under(view.paths.work, each), current.digest);
      overlaid.add(each);
    }

    files[each] = current.digest;
    brought.push(each);
  }

  await writeJson(view.paths.start, { ...start, files, overlaid: [...overlaid].sort() });

  return brought.sort();
};

/** Who in the team does a task: its plan's role, a developer's when it says none. */
export const roleOf = (task: RunTask): string => task.role ?? 'developer';

export interface NextTask {
  task?: RunTask;
  /**
   * The task is one the caller already holds and can go on with — a block lifted, changes requested: no take, its token
   * is still good.
   */
  yours?: 'in-progress' | 'changes-requested';
  /** Why nothing is ready, when nothing is. */
  why?: string;
  ready: string[];
  /** Nothing is ready, and nothing ever will be for this role: every task of it is done — the agent can stop. */
  finished?: boolean;
  /** What the lead said to the caller by name and it had not read. */
  messages: Message[];
  /** Tasks are ready, but the run's agents are all at work: the caller waits for a place. */
  full?: true;
  /** The run is stopping or stopped: nothing starts until it is resumed. */
  paused?: string;
  /** `--follow` gave up after its timeout, with nothing for the caller. */
  timedOut?: true;
}

/** `plitzi task next`: the ready task to take — highest priority, then the longest chain still to do. */
export const nextTask = async (ctx: RunContext, runId: string, role?: string): Promise<NextTask> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open'], 'start a task');
  const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
  const states = new Map(views.map(view => [view.task.id, view.state]));
  const held = new Set(views.filter(view => view.owner).map(view => view.task.id));
  // One role, or several an agent takes — `developer,reviewer`.
  const roles = role
    ?.split(',')
    .map(each => each.trim())
    .filter(Boolean);
  const forRole = (task: RunTask): boolean => roles === undefined || roles.includes(roleOf(task));
  // What the lead said to this agent by name — between tasks, there is nowhere else for it to arrive.
  const messages = await unreadFor(loaded, agentAddress(ctx.agent), true);
  // What the caller holds and can go on with comes before anything new: an agent between tasks waits with `next`, and
  // this is how it hears that its blocked task was unblocked, or that its review asked for changes.
  for (const view of views) {
    const { status } = view.state;
    if (view.owner?.agent === ctx.agent && (status === 'in-progress' || status === 'changes-requested')) {
      return { task: view.task, yours: status, ready: [], messages };
    }
  }

  const ready = readyTasks(loaded.tasks, states, held).filter(forRole);
  // A task the limit would not let this agent take is not offered: it is said, and `--follow` waits for a place.
  const atWork = new Set(
    views
      .filter(view => view.owner && (view.state.status === 'in-progress' || view.state.status === 'changes-requested'))
      .map(view => view.owner?.agent)
  );
  const full = !atWork.has(ctx.agent) && atWork.size >= loaded.record.agents;
  if (ready.length > 0 && full) {
    return {
      why: `${ready.map(task => task.id).join(', ')} ready, but ${String(atWork.size)} of the ${String(loaded.record.agents)} agents the run allows are at work: it is taken when one of them has nothing in progress`,
      ready: ready.map(task => task.id),
      full: true,
      messages
    };
  }

  if (ready.length > 0) {
    return { task: ready[0], ready: ready.map(task => task.id), messages };
  }

  const open = views.filter(view => view.state.status !== 'done');
  const others = roles === undefined ? [] : readyTasks(loaded.tasks, states, held).filter(task => !forRole(task));
  const coming = views.filter(view => view.state.status !== 'done' && forRole(view.task));
  const why =
    others.length > 0
      ? `nothing ready for a ${String(role)}: ready for others — ${others.map(task => `${task.id} (${roleOf(task)})`).join(', ')}`
      : roles !== undefined && coming.length === 0
        ? `no task is left for a ${String(role)}: every one is done`
        : open.length === 0
          ? 'every task is done: the run is ready to finish (plitzi run finish)'
          : `nothing is ready: ${open
              .map(
                view =>
                  `${view.task.id} ${view.state.status}${
                    view.owner
                      ? ` (${view.owner.agent}${isDisconnected(view.task, view.signalAt, ctx.now()) ? ', no signal — the lead may reassign it' : ''})`
                      : ''
                  }`
              )
              .join(', ')}`;

  return {
    why,
    ready: [],
    messages,
    ...(open.length === 0 || (roles !== undefined && coming.length === 0) ? { finished: true } : {})
  };
};

/**
 * `plitzi task next --follow`: waits until a task is ready for the role — another task approved, a block lifted — the
 * lead says something to the agent, or none ever will be (every task of it done), or `timeoutMs` passes. What an agent between tasks runs, rather than
 * stopping because nothing is ready this very moment.
 */
export const followNext = async (
  ctx: RunContext,
  runId: string,
  role: string | undefined,
  { timeoutMs = 30 * 60_000, everyMs = 10_000 } = {}
): Promise<NextTask> => {
  const started = Date.now();
  for (;;) {
    // A run stopped — gently, by its brake, or by a person at once — goes on once resumed: an agent waiting for work
    // waits through it.
    const next = await nextTask(ctx, runId, role).catch((error: unknown): NextTask => {
      if (isRunRefusal(error) && (error.code === 'stopping' || error.code === 'forced-stop')) {
        return { ready: [], messages: [], why: error.message, paused: error.message };
      }

      throw error;
    });
    if (next.task || next.finished || next.messages.length > 0) {
      return next;
    }

    if (Date.now() - started >= timeoutMs) {
      return {
        ...next,
        timedOut: true,
        why: `waited ${durationText(timeoutMs)} and nothing came for you: ${next.why ?? 'nothing is ready'} — run it again to go on waiting`
      };
    }

    await new Promise(resolve => setTimeout(resolve, everyMs));
  }
};

export interface TakenTask {
  task: RunTask;
  token: string;
  work: string;
  files: string[];
  /** Where its copy starts from: its last reviewed version, or none. */
  resumedFrom?: number;
  replaced?: string;
  /** What other tasks proposed to it and wait for an answer to (plitzi task answer). */
  proposals: ProposalView[];
  /** What the lead said to it and it had not read. */
  messages: Message[];
}

/**
 * `plitzi task take`: the task's owner made exclusively — of two at once, the first wins and the other is told to take
 * the next — its files locked, and its copy made: the project, the run's approved work over it, and the task's last
 * reviewed version if it was cut.
 */
export const takeTask = async (ctx: RunContext, runId: string, taskId: string, role?: string): Promise<TakenTask> => {
  if (ctx.token !== undefined) {
    throw new RunRefusal('invalid', 'Take a task without a token: the token is what taking it gives');
  }

  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open'], 'start a task');
  const task = findTask(loaded, taskId);
  if (role !== undefined && roleOf(task) !== role) {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}" is a ${roleOf(task)}’s, not a ${role}’s: plitzi task next --role ${role}`,
      {
        task: taskId,
        role: roleOf(task)
      }
    );
  }

  let view = await viewTask(loaded.paths, task);
  const states = new Map(
    await Promise.all(loaded.tasks.map(async each => [each.id, (await viewTask(loaded.paths, each)).state] as const))
  );
  if (view.state.status === 'done') {
    throw new RunRefusal('invalid', `Task "${taskId}" is done`, { task: taskId });
  }

  if (view.state.status === 'in-review') {
    throw new RunRefusal('invalid', `Task "${taskId}" is in review: take another (plitzi task next)`, { task: taskId });
  }

  if (!dependenciesDone(task, states)) {
    const pending = task.dependsOn.filter(dependency => states.get(dependency)?.status !== 'done');
    throw new RunRefusal('invalid', `Task "${taskId}" waits for ${pending.join(', ')} to be done`, {
      task: taskId,
      dependsOn: pending
    });
  }

  if (view.state.status === 'blocked') {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}" is blocked: ${view.state.blockedBy?.reason ?? ''} (${view.state.blockedBy?.needs ?? 'person'})`,
      { task: taskId }
    );
  }

  let replaced: string | undefined;
  if (view.owner) {
    if (!locksExpired(task, view.signalAt, ctx.now())) {
      if (view.owner.agent === ctx.agent) {
        throw new RunRefusal(
          'claimed',
          `Task "${taskId}" is yours already (${ctx.agent}, ${view.state.status}): no take — go on with its token (plitzi task context ${taskId})`,
          { task: taskId, holder: view.owner.agent, yours: true, next: `plitzi task context ${taskId} with its token` }
        );
      }

      throw new RunRefusal('claimed', `Task "${taskId}" is ${view.owner.agent}'s`, {
        task: taskId,
        holder: view.owner.agent,
        next: 'take the next one: plitzi task next'
      });
    }

    replaced = view.owner.agent;
    await cutTask(view, `${view.owner.agent} had no signal`, ctx.now);
    view = await viewTask(loaded.paths, task);
  }

  // The token names its run and task, so every command of the task needs only it.
  const token = `${runId}.${taskId}.${randomBytes(24).toString('hex')}`;
  const owner = { agent: ctx.agent, token, takenAt: at(ctx), machine: ctx.machine };
  // The agents at work are counted and the task taken under one lock: two takes at once never pass the limit together.
  await withLock(
    loaded.paths.takeLock,
    async () => {
      const working = (await Promise.all(loaded.tasks.map(each => viewTask(loaded.paths, each)))).filter(
        each =>
          each.task.id !== taskId &&
          each.owner !== undefined &&
          (each.state.status === 'in-progress' || each.state.status === 'changes-requested')
      );
      // The limit is on agents, not tasks: one that holds two — its own sent back while it works another — is one, and
      // taking one more adds no agent.
      const agents = new Set(working.map(each => each.owner?.agent));
      if (!agents.has(ctx.agent) && agents.size >= loaded.record.agents) {
        throw new RunRefusal(
          'agent-limit',
          `${String(agents.size)} of the ${String(loaded.record.agents)} agents run "${runId}" allows are at work (${working.map(each => `${each.task.id}: ${String(each.owner?.agent)}`).join(', ')}): take "${taskId}" when one of them finishes`,
          { task: taskId, working: working.map(each => each.task.id), limit: loaded.record.agents }
        );
      }

      if (!(await createExclusive(view.paths.owner, `${JSON.stringify(owner, null, 2)}\n`))) {
        const holder = await readOwner(view.paths);
        throw new RunRefusal('claimed', `Task "${taskId}" was taken meanwhile${holder ? ` by ${holder.agent}` : ''}`, {
          task: taskId,
          ...(holder ? { holder: holder.agent } : {}),
          next: 'take the next one: plitzi task next'
        });
      }

      // Counted as at work from now, before its copy is made: the next take under the lock sees it.
      await updateState(
        view.paths,
        state => ({ ...state, status: state.status === 'changes-requested' ? 'changes-requested' : 'in-progress' }),
        ctx.now
      );
    },
    { now: ctx.now }
  );

  try {
    const locks = await allLocks(ctx);
    for (const file of task.files) {
      const other = (locks.get(file) ?? []).find(held => held.live && !(held.run === runId && held.task === taskId));
      if (other) {
        throw new RunRefusal(
          'claimed',
          `${file} is held by task "${other.task}"${other.run === runId ? '' : ` of run "${other.run}"`}`,
          { file, holder: other.task, ...(other.until ? { until: other.until } : {}) }
        );
      }
    }

    for (const file of task.files) {
      const lock: FileLock = { runId, taskId, agent: ctx.agent, intent: task.title, since: at(ctx), kind: 'own' };
      await writeJson(lockFile(view.paths, file), lock);
    }

    // Its files and the shared ones as the project holds them now, kept: the base of every conflict this task can meet,
    // and of the diff of every request it makes.
    await keepFiles(loaded.paths, ctx.root, [...new Set([...task.files, ...(await sharedFiles(loaded))])]);
    await fs.rm(view.paths.cache, { recursive: true, force: true });
    const keep = new Set(task.files);
    const files = (await projectFiles(ctx.root)).filter(file => isCopied(file, keep));
    const start: TaskStart = {
      copiedAt: at(ctx),
      files: await cloneFiles(ctx.root, view.paths.work, files),
      overlaid: []
    };
    // Never copied, never counted: there for what the agent writes aside (a server's log), as in the project — and for
    // who the copy is, so a command run inside it needs no token, run or agent said.
    await fs.mkdir(path.join(view.paths.work, 'tmp'), { recursive: true });
    await writeJson(path.join(view.paths.work, COPY_TASK_FILE), { run: runId, task: taskId, token, agent: ctx.agent });
    const approved = await readApproved(loaded.paths);
    for (const [file, entry] of Object.entries(approved.files)) {
      await placeVersion(loaded.paths, under(view.paths.work, file), entry.digest);
      start.files[file] = entry.digest;
      start.overlaid.push(file);
    }

    start.overlaid.sort();
    await writeJson(view.paths.start, start);
    if (view.reviewed) {
      for (const [file, digest] of Object.entries(view.reviewed.files)) {
        await placeVersion(loaded.paths, under(view.paths.work, file), digest);
      }
    }

    await writeJson(view.paths.progress, { heartbeatAt: at(ctx) });
    await updateState(
      view.paths,
      state => ({
        ...state,
        status: state.status === 'changes-requested' ? 'changes-requested' : 'in-progress',
        cutAt: undefined,
        notes: [
          ...state.notes,
          { at: at(ctx), by: ctx.agent, text: replaced ? `Taken over from ${replaced}, who had no signal` : 'Taken' }
        ]
      }),
      ctx.now
    );
  } catch (error) {
    await fs.rm(view.paths.locks, { recursive: true, force: true });
    await revokeOwner(view.paths);
    await updateState(view.paths, state => ({ ...state, status: 'ready' }), ctx.now);
    throw error;
  }

  await appendLog(view.paths.log, { at: at(ctx), by: ctx.agent, action: 'take' });
  await logRun(ctx, loaded.paths, { action: 'take', task: taskId, ...(replaced ? { replaced } : {}) });

  return {
    task,
    token,
    work: view.paths.work,
    files: task.files,
    ...(view.reviewed ? { resumedFrom: view.reviewed.round } : {}),
    ...(replaced ? { replaced } : {}),
    proposals: unansweredTo(await proposalsOf(loaded), taskId),
    messages: await unreadForHolder(loaded, taskId, ctx.agent, true)
  };
};

/** What the run shares: what was found shared when it opened, and the project's entries. */
const sharedFiles = async (loaded: LoadedRun): Promise<Set<string>> =>
  new Set((await readShared(loaded.paths)).files.map(file => file.file));

export interface ClaimOutcome {
  file: string;
  granted: boolean;
  /** Not granted: whether to wait (one task ahead at most) or to change it in the copy as a request. */
  turn?: 'wait' | 'request';
  holder?: string;
}

/** The task whose plan names `file`, if one does. */
/**
 * The task whose plan names `file` while it is not done: once done, it holds nothing — its files are taken by turns,
 * and a shared one is requested like any other. An integration task is never one: the shared file it applies requests
 * to stays shared, held by its lock only while it is worked — until then, taken by turns or requested like any other.
 */
const activeHolder = async (loaded: LoadedRun, file: string): Promise<RunTask | undefined> => {
  const planned = loaded.tasks.find(task => task.kind !== 'integration' && task.files.includes(file));

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

  const planned = await activeHolder(loaded, clean);
  if (planned) {
    throw new RunRefusal('claimed', `${clean} is task "${planned.id}"'s: wait for it (plitzi task wait)`, {
      file: clean,
      holder: planned.id,
      turn: 'wait'
    });
  }

  const holder = (await locksOn(ctx, clean)).find(held => held.live && !(held.run === runId && held.task === taskId));
  if (holder) {
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
  }

  const lock: FileLock = {
    runId,
    taskId,
    agent: view.owner?.agent ?? ctx.agent,
    intent: `by turns, for ${task.title}`,
    since: at(ctx),
    kind: 'turn'
  };
  if (!(await createExclusive(lockFile(view.paths, clean), `${JSON.stringify(lock, null, 2)}\n`))) {
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
const grantWaiters = async (ctx: RunContext, loaded: LoadedRun, files: readonly string[]): Promise<string[]> => {
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
    await writeJson(lockFile(next.paths, file), lock);
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
export const assertNoWaitCycle = async (loaded: LoadedRun, taskId: string, holder: string): Promise<void> => {
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
): Promise<{ file: string; holder?: string; granted?: true }> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'wait for a file');
  const task = findTask(loaded, taskId);
  const view = await holderOf(ctx, loaded, task);
  const clean = cleanPath(ctx.root, file);
  const holder = await holderTaskOf(ctx, loaded, clean, taskId);
  // Let go of before the wait came — its holder approved meanwhile: nothing to wait for, it is taken by turns now.
  if (!holder) {
    await claimFile(ctx, runId, taskId, clean);

    return { file: clean, granted: true };
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
    await new Promise(resolve => setTimeout(resolve, everyMs));
  }
};

/** `plitzi task progress` and `plitzi task heartbeat`: the holder's sign of life, with where it is if it says. */
export interface Signal {
  task: string;
  at: string;
  /** The run is stopping or stopped: said with every sign of life, so the agent knows before a refusal tells it. */
  run?: { status: string; reason?: string };
  /** Without another sign of life by then, the lead may reassign it. */
  quietAfter: string;
  /** …and by then another agent may take it. */
  takenAfter: string;
  /** What the lead said to it and it had not read: handed over with every sign of life. */
  messages: Message[];
}

export const reportProgress = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  progress: { fraction?: number; step?: string }
): Promise<Signal> => {
  const loaded = await loadRun(ctx, runId);
  const task = findTask(loaded, taskId);
  const view = await holderOf(ctx, loaded, task);
  if (progress.fraction !== undefined && (progress.fraction < 0 || progress.fraction > 1)) {
    throw new RunRefusal('invalid', 'A fraction is between 0 and 1: 0.6 is 60 %');
  }

  await writeJson(view.paths.progress, {
    ...(view.progress ?? {}),
    ...progress,
    heartbeatAt: at(ctx)
  });
  const now = ctx.now().getTime();

  return {
    task: taskId,
    at: at(ctx),
    ...(loaded.record.status === 'open'
      ? {}
      : {
          run: {
            status: loaded.record.status,
            ...(loaded.record.stopReason ? { reason: loaded.record.stopReason } : {})
          }
        }),
    quietAfter: new Date(now + noSignalAfter(task)).toISOString(),
    takenAfter: new Date(now + noSignalAfter(task) + DEFAULTS.lockAfterSignalMs).toISOString(),
    messages: await unreadForHolder(loaded, taskId, ctx.agent, true)
  };
};

/** `plitzi task block`: something outside the plan stops it — said, never waited on silently. */
export const blockTask = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  reason: string,
  needs: Needs
): Promise<void> => {
  const loaded = await loadRun(ctx, runId);
  const task = findTask(loaded, taskId);
  const view = await holderOrCoordinator(ctx, loaded, task);
  await updateState(
    view.paths,
    state => ({
      ...state,
      status: 'blocked',
      blockedBy: { reason, needs },
      notes: [...state.notes, { at: at(ctx), by: ctx.agent, text: `Blocked (${needs}): ${reason}` }]
    }),
    ctx.now
  );
  await logRun(ctx, loaded.paths, { action: 'block', task: taskId, needs, reason });
};

/**
 * `plitzi task unblock`: a block lifted — with `answer`, what it was waiting for, said to the task (it reaches its agent
 * with its next command) and kept in its notes. Its holder hears it from `task next`; with nobody on it, it is ready.
 */
export const unblockTask = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  answer?: string
): Promise<TaskState> => {
  requireNoTask(ctx, 'unblock a task');
  const loaded = await loadRun(ctx, runId);
  const task = findTask(loaded, taskId);
  const view = await viewTask(loaded.paths, task);
  if (view.state.status !== 'blocked') {
    throw new RunRefusal('invalid', `Task "${taskId}" is not blocked, it is ${view.state.status}`, { task: taskId });
  }

  const said =
    answer === undefined ? undefined : await sendMessage(ctx, loaded, { from: LEAD, to: taskId, text: answer });
  await logRun(ctx, loaded.paths, {
    action: 'unblock',
    task: taskId,
    needed: view.state.blockedBy?.needs,
    ...(said ? { message: said.id } : {})
  });

  // A block can last: what the run approved meanwhile comes into the copy now, not only at its complete.
  const brought = view.owner ? await refreshCopy(ctx, loaded, view) : [];

  return updateState(
    view.paths,
    state => ({
      ...state,
      status: view.owner ? (state.round > 0 ? 'changes-requested' : 'in-progress') : 'ready',
      blockedBy: undefined,
      notes: [
        ...state.notes,
        { at: at(ctx), by: ctx.agent, text: answer === undefined ? 'Unblocked' : `Unblocked: ${answer}` },
        ...(brought.length > 0
          ? [
              {
                at: at(ctx),
                by: 'plitzi',
                text: `Its copy brought what the run approved meanwhile: ${brought.join(', ')}`
              }
            ]
          : [])
      ]
    }),
    ctx.now
  );
};

/** `plitzi task note` and `plitzi task handoff`: what whoever comes next must know. */
export const noteTask = async (ctx: RunContext, runId: string, taskId: string, text: string): Promise<void> => {
  const loaded = await loadRun(ctx, runId, { anyVersion: true });
  const task = findTask(loaded, taskId);
  const view = await holderOrCoordinator(ctx, loaded, task);
  await updateState(
    view.paths,
    state => ({ ...state, notes: [...state.notes, { at: at(ctx), by: ctx.agent, text }] }),
    ctx.now
  );
};

/** What a task's copy changed against where it started, by project path: what is not the source left out. */
const changedInCopy = async (view: TaskView, start: TaskStart): Promise<string[]> => {
  const inCopy = await projectFiles(view.paths.work);
  const changed = new Set<string>();
  for (const file of inCopy) {
    if ((await fingerprint(under(view.paths.work, file))) !== (start.files[file] ?? null)) {
      changed.add(file);
    }
  }

  for (const [file, digest] of Object.entries(start.files)) {
    if (digest !== null && !inCopy.includes(file)) {
      changed.add(file);
    }
  }

  return [...changed].sort();
};

/**
 * Puts the task's change together with the run's, for each of `files` whose run version moved since the copy was made —
 * approved by another task meanwhile. Refused, with what the task changed, when both changed the same lines: the task
 * takes the run's version and redoes its change on it.
 */
const mergeMoved = async (
  ctx: RunContext,
  loaded: LoadedRun,
  view: TaskView,
  files: readonly string[]
): Promise<string[]> => {
  const start = await readStart(view.paths);
  if (!start) {
    return [];
  }

  const approved = await readApproved(loaded.paths);
  const merged: string[] = [];
  const conflicts: { file: string; diff: string }[] = [];
  const next = { ...start.files };
  const overlaid = new Set(start.overlaid);
  for (const file of [...new Set(files)]) {
    const entry = entryOf(approved.files, file);
    const from = start.files[file] ?? null;
    if (!entry || entry.digest === from || entry.digest === null) {
      continue;
    }

    const base = from === null ? '' : await textOf(loaded, ctx, from, file);
    const ours = (await readOptional(under(view.paths.work, file)))?.toString('utf-8') ?? '';
    const theirs = await textOf(loaded, ctx, entry.digest, file);
    const result = mergeLines(base, ours, theirs);
    if (!result.ok) {
      conflicts.push({ file, diff: unifiedDiff(file, base, ours) });
      continue;
    }

    await writeAtomic(under(view.paths.work, file), result.text);
    next[file] = entry.digest;
    overlaid.add(file);
    merged.push(file);
  }

  await writeJson(view.paths.start, { ...start, files: next, overlaid: [...overlaid].sort() });
  if (conflicts.length > 0) {
    // Counted as the conflicts at approval are: in the run's report, and by its brake.
    await recordBrake(ctx, loaded, 'conflict');
    // Who changed those lines in the run: what the agent weighs before it redoes anything over approved work.
    const by = conflicts.map(each => {
      const entry = entryOf(approved.files, each.file);

      return `${each.file}${entry ? ` (by "${entry.task}", approved)` : ''}`;
    });
    throw new RunRefusal(
      'conflict',
      `The run changed ${by.join(', ')} since task "${view.task.id}"'s copy was made, on the same lines this task changed. If your change still fits beside it, take the run's version (plitzi task discard <file>), redo your change on it — what this task changed is in this answer — and complete again. If your acceptance contradicts what was approved, do not undo it: ask the lead (plitzi task ask "…")`,
      {
        task: view.task.id,
        files: conflicts.map(each => each.file),
        yours: conflicts,
        next: 'redo your change (the `yours` diff) on the run’s version (plitzi task discard <file>) — or, if it contradicts the approved one, ask the lead'
      }
    );
  }

  return merged.sort();
};

export interface CompletedTask {
  changed: string[];
  /** Approved in the run since the copy was made, and brought into it before the checks. */
  brought: string[];
  /** Shared files nobody else held, taken by turns as it completed: they go into the run with it. */
  claimed: string[];
  /** Files the run changed since the copy was made, put together with the task's change line by line. */
  merged: string[];
  /** What the lead said to it and it had not read. */
  messages: Message[];
  requests: SharedRequest[];
  checks: CheckResult;
  /** The task's files a person (or something else) changed in the project meanwhile: the person wins at the merge. */
  changedInProject: string[];
}

/**
 * `plitzi task complete`: the copy compared with where it started, by fingerprint — what it changed outside its files
 * is refused, naming each; what it changed in a shared file it does not hold becomes a request — then the project's
 * checks run in the copy, and it goes to review.
 */
export interface CompleteOptions {
  /** Go to review although the checks fail — for a reason that weighs, with the task that fixes it. */
  knownFailure?: { why: string; fixedBy?: string };
}

export const completeTask = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  options: CompleteOptions = {}
): Promise<CompletedTask> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'complete a task');
  const task = findTask(loaded, taskId);
  const view = await holderOf(ctx, loaded, task);
  if (!['in-progress', 'changes-requested'].includes(view.state.status)) {
    throw new RunRefusal('invalid', `Task "${taskId}" is ${view.state.status}: only a task in progress completes`, {
      task: taskId
    });
  }

  if (!(await readStart(view.paths))) {
    throw new RunRefusal('invalid', `Task "${taskId}" has no copy: take it again (plitzi task take ${taskId})`);
  }

  const unanswered = unansweredTo(await proposalsOf(loaded), taskId);
  if (unanswered.length > 0) {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}" has proposals to answer first: ${unanswered.map(each => `${each.id} from ${each.from} (${each.change})`).join('; ')} — plitzi task answer <proposal> --accept | --reject "…" | --counter "…"`,
      { task: taskId, proposals: unanswered.map(each => each.id) }
    );
  }

  // Checked against the run as it is now: what was approved since the copy was made, and the task left alone, comes in.
  const brought = await refreshCopy(ctx, loaded, view);
  const started = await readStart(view.paths);
  if (!started) {
    throw new RunRefusal('invalid', `Task "${taskId}" has no copy: take it again (plitzi task take ${taskId})`);
  }

  const changed = await changedInCopy(view, started);
  const held = await lockedFiles(view.paths);
  const shared = await sharedFiles(loaded);
  const outside: { file: string; holder: string }[] = [];
  const asRequests: string[] = [];
  // A folder's placeholder goes once the task puts a file in it: the .gitkeep of a folder it writes into is its to remove.
  const ownFolders = new Set(
    changed.filter(file => held.has(file) || task.files.includes(file)).map(file => path.posix.dirname(file))
  );
  for (const file of changed) {
    if (held.has(file) || (path.posix.basename(file) === '.gitkeep' && ownFolders.has(path.posix.dirname(file)))) {
      continue;
    }

    // A file no task at work holds — shared, a done task's, or in no task of the plan — is taken by turns as the task
    // completes when it is free (the same an agent gets from `task claim`), and requested when it is not. A new file
    // nobody names is the task's.
    const planned = await activeHolder(loaded, file);
    if (planned && planned.id !== taskId) {
      outside.push({ file, holder: planned.id });
    } else if (shared.has(file) || Object.hasOwn(started.files, file)) {
      asRequests.push(file);
    }
  }

  if (outside.length > 0) {
    await recordBrake(ctx, loaded, 'refused');
    throw new RunRefusal(
      'claimed',
      `Task "${taskId}" changed files another task at work holds: ${outside
        .map(each => `${each.file} (task "${each.holder}"'s)`)
        .join(
          ', '
        )}. Put each back in your copy (plitzi task discard <file>) and propose the change to its task (plitzi task propose <task> --change …), or wait for it (plitzi task wait <file>).`,
      {
        task: taskId,
        files: outside.map(each => each.file),
        next: 'put each back (plitzi task discard <file>) and propose the change to its task, or wait for the file (plitzi task wait <file>) and complete again'
      }
    );
  }

  // A shared file nobody else holds is taken by turns as the task completes: its change goes into the run when the task
  // is approved, so what it connects (a page in the entry) shows as the run goes — not only once an integration runs.
  const locks = await allLocks(ctx);
  const claimedNow: string[] = [];
  for (const file of [...asRequests]) {
    const other = (locks.get(file) ?? []).find(each => each.live && !(each.run === runId && each.task === taskId));
    const lock: FileLock = {
      runId,
      taskId,
      agent: view.owner?.agent ?? ctx.agent,
      intent: `by turns, for ${task.title}`,
      since: at(ctx),
      kind: 'turn'
    };
    if (!other && (await createExclusive(lockFile(view.paths, file), `${JSON.stringify(lock, null, 2)}\n`))) {
      claimedNow.push(file);
      asRequests.splice(asRequests.indexOf(file), 1);
    }
  }

  // The run's version of a file it changed moved since its copy was made: the two changes are put together line by line.
  const mergedNow = await mergeMoved(ctx, loaded, view, [
    ...changed.filter(file => held.has(file) || task.files.includes(file)),
    ...claimedNow
  ]);
  const start = (await readStart(view.paths)) ?? started;

  const { knownFailure } = options;
  const fixer = knownFailure?.fixedBy === undefined ? undefined : findTask(loaded, knownFailure.fixedBy);
  if (fixer && (fixer.id === taskId || (await viewTask(loaded.paths, fixer)).state.status === 'done')) {
    throw new RunRefusal(
      'invalid',
      `--fixed-by names the task that fixes what fails later: "${fixer.id}" is ${fixer.id === taskId ? 'this task' : 'done'}`,
      { task: taskId }
    );
  }

  const checks = await ctx.checks(view.paths.work, ctx.root);
  const failing = checks.steps.filter(step => !step.ok);
  // What fails in the copy may not be the task's: a person's edit in the project, or another task's approved work, that
  // fails the checks reaches every copy. Checked against the run's work without this task before it is refused.
  const preexisting =
    !checks.ok && !knownFailure
      ? failsWithout(checks, await checkVersions(ctx, loaded, digestsOf(await readApproved(loaded.paths))), [
          `${view.paths.work}${path.sep}`,
          new RegExp(`${escapeRegExp(path.join(loaded.paths.cache, 'check-'))}[0-9a-f]+${escapeRegExp(path.sep)}`, 'g')
        ])
      : false;
  if (!checks.ok) {
    if (!preexisting) {
      await recordBrake(ctx, loaded, 'checks-failed');
    }

    if (!knownFailure && !preexisting) {
      throw new RunRefusal('checks-failed', `The project's checks fail in task "${taskId}"'s copy`, {
        task: taskId,
        steps: failing,
        next: 'fix what fails and complete again — or, for a reason that weighs, complete --known-failure "why" --fixed-by <task>'
      });
    }

    if (fixer && knownFailure) {
      await updateState(
        taskPaths(loaded.paths, fixer.id),
        state => ({
          ...state,
          notes: [
            ...state.notes,
            {
              at: at(ctx),
              by: 'plitzi',
              text: `"${taskId}" went to review with failing checks (${failing.map(step => step.name).join(', ')}) for you to fix: ${knownFailure.why}`
            }
          ]
        }),
        ctx.now
      );
    }
  }

  // What the task was asked, held by the commands its plan gives — once the project's checks pass, in the same copy.
  const accepted = checks.ok
    ? await checkAcceptance(task.acceptance, { work: view.paths.work, root: ctx.root, cache: view.paths.cache })
    : [];
  const unmet = accepted.filter(result => !result.ok);
  if (unmet.length > 0 && !knownFailure) {
    await recordBrake(ctx, loaded, 'checks-failed');
    throw new RunRefusal(
      'checks-failed',
      `Task "${taskId}"'s acceptance is not met: ${unmet.map(each => `"${each.said}"`).join(', ')}`,
      {
        task: taskId,
        steps: unmet.map(each => ({
          name: `acceptance — ${each.said}`,
          ok: false,
          said: [each.check, ...(each.output ?? [])]
        })),
        next: 'make the copy do what the acceptance asks — each check is a command, run it yourself in the copy — and complete again'
      }
    );
  }

  const existing = new Map((await readRequests(view.paths)).map(request => [request.file, request]));
  const requests: SharedRequest[] = [];
  for (const file of asRequests) {
    const bytes = await readOptional(under(view.paths.work, file));
    const before = existing.get(file);
    const request: SharedRequest = {
      id: requestId(file),
      file,
      summary: before?.summary ?? `Changed by task "${taskId}" (${task.title})`,
      usedIn: before?.usedIn ?? task.files,
      blocking: before?.blocking ?? false,
      at: at(ctx),
      base: start.files[file] ?? null,
      wanted: bytes === undefined ? null : await putBlob(loaded.paths, bytes)
    };
    await writeRequest(view.paths, request);
    requests.push(request);
  }

  const base = await readBase(loaded.paths);
  const changedInProject: string[] = [];
  for (const file of task.files) {
    const was = start.overlaid.includes(file) ? (base.files[file] ?? null) : (start.files[file] ?? null);
    if ((await fingerprint(under(ctx.root, file))) !== was) {
      changedInProject.push(file);
    }
  }

  await updateState(
    view.paths,
    state => ({
      ...state,
      status: 'in-review',
      changed: changed.filter(file => !asRequests.includes(file)),
      ...(accepted.length > 0 ? { accepted } : { accepted: undefined }),
      knownFailure: preexisting
        ? {
            why: `the run's work fails ${failing.map(step => step.name).join(', ')} the same way without this task: ${failing.flatMap(step => step.said ?? []).find(line => line.trim() !== '') ?? 'see the checks'}`,
            failing: failing.map(step => step.name),
            preexisting: true,
            at: at(ctx)
          }
        : !checks.ok && knownFailure
          ? {
              why: knownFailure.why,
              failing: failing.map(step => step.name),
              ...(knownFailure.fixedBy ? { fixedBy: knownFailure.fixedBy } : {}),
              at: at(ctx)
            }
          : undefined,
      notes: [
        ...state.notes,
        ...(changedInProject.length > 0
          ? [
              {
                at: at(ctx),
                by: 'plitzi',
                text: `Changed in the project meanwhile: ${changedInProject.join(', ')} — the project's version wins at the final merge; take it (plitzi task discard <file>) and adapt`
              }
            ]
          : [])
      ]
    }),
    ctx.now
  );
  await recordBrake(ctx, loaded, 'completed');
  await appendLog(view.paths.log, { at: at(ctx), by: ctx.agent, action: 'complete', changed, requests: asRequests });
  await logRun(ctx, loaded.paths, { action: 'complete', task: taskId, changed: changed.length, requests: asRequests });

  return {
    changed,
    brought,
    claimed: claimedNow,
    merged: mergedNow,
    requests,
    checks,
    changedInProject,
    messages: await unreadForHolder(loaded, taskId, ctx.agent, true)
  };
};

/**
 * `plitzi task discard`: a file of the copy put back to the run's version now — and the copy starts from it — with
 * whatever else the run approved since the copy was made and the task did not touch. Answers what it brought.
 */
export const discardFile = async (ctx: RunContext, runId: string, taskId: string, file: string): Promise<string[]> => {
  const loaded = await loadRun(ctx, runId);
  const task = findTask(loaded, taskId);
  const view = await holderOf(ctx, loaded, task);

  return refreshCopy(ctx, loaded, view, cleanPath(ctx.root, file));
};

/** `plitzi task request`: why a task wants a change in a shared file, and where it uses it; `--blocking` cannot wait. */
export const requestShared = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  file: string,
  ask: { summary: string; usedIn: string[]; blocking: boolean }
): Promise<{ request: SharedRequest; integration?: string }> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'request a shared change');
  const task = findTask(loaded, taskId);
  const view = await holderOf(ctx, loaded, task);
  const clean = cleanPath(ctx.root, file);
  const planned = await activeHolder(loaded, clean);
  if (planned && planned.id !== taskId && !(await sharedFiles(loaded)).has(clean)) {
    throw new RunRefusal('claimed', `${clean} is task "${planned.id}"'s, not shared: wait for it (plitzi task wait)`, {
      file: clean,
      holder: planned.id
    });
  }

  const start = await readStart(view.paths);
  const request: SharedRequest = {
    id: requestId(clean),
    file: clean,
    summary: ask.summary,
    usedIn: ask.usedIn.length > 0 ? ask.usedIn : task.files,
    blocking: ask.blocking,
    at: at(ctx),
    base: start?.files[clean] ?? null,
    // What the copy holds now: a request made before the change is written again, as it is, at complete.
    wanted: await readOptional(under(view.paths.work, clean)).then(bytes =>
      bytes === undefined ? null : putBlob(loaded.paths, bytes)
    )
  };
  await writeRequest(view.paths, request);
  await logRun(ctx, loaded.paths, { action: 'request', task: taskId, file: clean, blocking: ask.blocking });
  if (!ask.blocking) {
    return { request };
  }

  const integration = await withLock(
    loaded.paths.mergeLock,
    () => integrationFor(ctx, loaded, clean, [`${taskId}/${request.id}`], []),
    {
      now: ctx.now
    }
  );
  await updateState(
    view.paths,
    state => ({
      ...state,
      status: 'waiting',
      waitingFor: { file: clean, task: integration, since: at(ctx) },
      notes: [...state.notes, { at: at(ctx), by: ctx.agent, text: `Waits for ${integration}, which makes ${clean}` }]
    }),
    ctx.now
  );

  return { request, integration };
};

const integrationAcceptance = async (
  loaded: LoadedRun,
  file: string,
  requests: readonly string[]
): Promise<string[]> => {
  const summaries: string[] = [];
  for (const request of requests) {
    const [requester, requestName] = request.split('/');
    const found = (await readRequests(taskPaths(loaded.paths, requester))).find(each => each.id === requestName);
    if (found) {
      summaries.push(`${requester}: ${found.summary}`);
    }
  }

  return [
    `Every request on ${file} applied together: ${summaries.join('; ')}`,
    'The pages of the requesting tasks pass their checks with it',
    'Contradictory requests are not picked between: they go to the lead or a person'
  ];
};

/** Adds `requests` to an integration task nobody works yet, after `dependsOn` too. Under the merge lock. */
const joinIntegration = async (
  ctx: RunContext,
  loaded: LoadedRun,
  task: RunTask,
  requests: readonly string[],
  dependsOn: readonly string[]
): Promise<void> => {
  const integrates = [...new Set([...(task.integrates ?? []), ...requests])];
  const joined: RunTask = {
    ...task,
    dependsOn: [...new Set([...task.dependsOn, ...dependsOn])],
    acceptance: await integrationAcceptance(loaded, task.files[0], integrates),
    integrates
  };
  const paths = taskPaths(loaded.paths, task.id);
  await writeJson(paths.definition, joined);
  loaded.tasks[loaded.tasks.indexOf(task)] = joined;
  await updateState(
    paths,
    state => ({
      ...state,
      notes: [...state.notes, { at: at(ctx), by: 'plitzi', text: `Joined by ${requests.join(', ')}` }]
    }),
    ctx.now
  );
  await logRun(ctx, loaded.paths, {
    action: 'integration',
    task: task.id,
    file: task.files[0],
    requests,
    joined: true
  });
};

/**
 * The integration task that applies `requests` on `file`: the one nobody works yet joined — one per file, so what is
 * asked meanwhile never races it — or a new one, after any already being worked. Under the merge lock.
 */
const integrationFor = async (
  ctx: RunContext,
  loaded: LoadedRun,
  file: string,
  requests: string[],
  dependsOn: string[]
): Promise<string> => {
  const open: { task: RunTask; view: TaskView }[] = [];
  for (const task of loaded.tasks.filter(each => each.kind === 'integration' && each.files.includes(file))) {
    const view = await viewTask(loaded.paths, task);
    if (view.state.status !== 'done') {
      open.push({ task, view });
    }
  }

  const waiting = open.find(each => !each.view.owner);
  if (waiting) {
    await joinIntegration(ctx, loaded, waiting.task, requests, dependsOn);

    return waiting.task.id;
  }

  return createIntegration(ctx, loaded, file, requests, [...dependsOn, ...open.map(each => each.task.id)]);
};

/** Makes an integration task on `file` for `requests` (as `<task>/<request>`), after `dependsOn`. Under the merge lock. */
const createIntegration = async (
  ctx: RunContext,
  loaded: LoadedRun,
  file: string,
  requests: string[],
  dependsOn: string[]
): Promise<string> => {
  const taken = new Set(loaded.tasks.map(task => task.id));
  const stem = `integrate-${requestId(file).toLowerCase()}`.slice(0, 56);
  let id = stem;
  for (let n = 2; taken.has(id) || !ID.test(id); n += 1) {
    id = `${stem}-${String(n)}`;
  }

  const task: RunTask = {
    id,
    title: `Integrate the requests on ${file}`,
    files: [file],
    dependsOn,
    priority: 'high',
    estimateMinutes: 15,
    acceptance: await integrationAcceptance(loaded, file, requests),
    kind: 'integration',
    integrates: requests
  };
  const paths = taskPaths(loaded.paths, id);
  await writeJson(paths.definition, task);
  await writeJson(paths.state, {
    status: 'ready',
    round: 0,
    notes: [{ at: at(ctx), by: 'plitzi', text: `Made by the CLI for ${requests.join(', ')}` }],
    updatedAt: at(ctx)
  } satisfies TaskState);
  loaded.tasks.push(task);
  await logRun(ctx, loaded.paths, { action: 'integration', task: id, file, requests });

  return id;
};

/** Every request of the run with whether an integration task covers it, and whether that task is done. */
export const requestsOf = async (
  loaded: LoadedRun
): Promise<{ task: string; request: SharedRequest; integratedBy?: string; integrated: boolean }[]> => {
  const covered = new Map<string, string>();
  for (const task of loaded.tasks) {
    task.integrates?.forEach(key => covered.set(key, task.id));
  }

  const all: { task: string; request: SharedRequest; integratedBy?: string; integrated: boolean }[] = [];
  for (const task of loaded.tasks) {
    for (const request of await readRequests(taskPaths(loaded.paths, task.id))) {
      const by = covered.get(`${task.id}/${request.id}`);
      const integrated =
        by !== undefined && (await viewTask(loaded.paths, findTask(loaded, by))).state.status === 'done';
      all.push({ task: task.id, request, ...(by ? { integratedBy: by } : {}), integrated });
    }
  }

  return all;
};

/** When every task that asked for a change in a shared file is approved, one integration task applies them all. */
const integrateWhenReady = async (ctx: RunContext, loaded: LoadedRun): Promise<string[]> => {
  const made: string[] = [];
  const all = (await requestsOf(loaded)).filter(each => each.integratedBy === undefined);
  const byFile = new Map<string, typeof all>();
  all.forEach(each => byFile.set(each.request.file, [...(byFile.get(each.request.file) ?? []), each]));
  const locks = await allLocks(ctx);
  for (const [file, requests] of byFile) {
    const requesters = [...new Set(requests.map(each => each.task))];
    const states = await Promise.all(requesters.map(id => viewTask(loaded.paths, findTask(loaded, id))));
    // A file another task holds by turns waits for it: once it lets go, its requests are merged then, and only what
    // does not merge is integrated.
    const held = (locks.get(file) ?? []).some(each => each.live && !requesters.includes(each.task));
    if (held || !states.every(view => view.state.status === 'done')) {
      continue;
    }

    made.push(
      await integrationFor(
        ctx,
        loaded,
        file,
        requests.map(each => `${each.task}/${each.request.id}`),
        requesters
      )
    );
  }

  return made;
};

/**
 * The requests of done tasks on `files` — just let go of — merged into the run's work now when they merge line by line,
 * so they never wait for an integration task. An integration task left with none of its requests to apply, and nobody
 * on it, is done: said in its notes.
 */
const settleRequests = async (ctx: RunContext, loaded: LoadedRun, files: readonly string[]): Promise<string[]> => {
  const settled: string[] = [];
  for (const each of await requestsOf(loaded)) {
    if (!files.includes(each.request.file) || each.integrated) {
      continue;
    }

    const requester = await viewTask(loaded.paths, findTask(loaded, each.task));
    if (requester.state.status !== 'done') {
      continue;
    }

    const went = await changeApproved(ctx, loaded, approved =>
      buildRequestMerge(ctx, loaded, requester, each.request, approved)
    );
    if (went !== undefined && !('failed' in went)) {
      await fs.rm(path.join(requester.paths.requests, `${each.request.id}.json`), { force: true });
      settled.push(`${each.task}/${each.request.id}`);
    }
  }

  if (settled.length === 0) {
    return [];
  }

  const left = new Set((await requestsOf(loaded)).map(each => `${each.task}/${each.request.id}`));
  for (const task of loaded.tasks.filter(each => each.kind === 'integration')) {
    const view = await viewTask(loaded.paths, task);
    const open = (task.integrates ?? []).filter(key => left.has(key));
    if (open.length === 0 && !view.owner && (view.state.status === 'ready' || view.state.status === 'pending')) {
      await updateState(
        view.paths,
        state => ({
          ...state,
          status: 'done',
          notes: [
            ...state.notes,
            {
              at: at(ctx),
              by: 'plitzi',
              text: 'Nothing left to integrate: every request merged as the file was let go of'
            }
          ]
        }),
        ctx.now
      );
      settled.push(task.id);
    }
  }

  await logRun(ctx, loaded.paths, { action: 'settle', settled });

  return settled;
};

export interface ReviewedTask {
  verdict: 'approve' | 'changes';
  round: number;
  /** Approved: what it brought into the run's work, what it let go of to whom, and the tasks it made ready. */
  merged?: string[];
  granted?: string[];
  ready?: string[];
  integrations?: string[];
  /** Requests of done tasks on the files it let go of, merged now — and integration tasks left with nothing to do. */
  settled?: string[];
  /** Sent to a person after the round limit. */
  toPerson?: boolean;
  /** Its files a person changed meanwhile, put together with its change (--merge). */
  joined?: string[];
}

interface Built {
  next: ApprovedManifest;
  /** Files put together line by line with the run's newer version: what the checks look at before it goes in. */
  merged: string[];
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const digestsOf = (manifest: ApprovedManifest): Record<string, string | null> =>
  Object.fromEntries(Object.entries(manifest.files).map(([file, entry]) => [file, entry.digest]));

/**
 * Changes the run's approved work. `build` makes the next manifest from the one there is; when it merged a file with the
 * run's newer version, the project's checks run over the whole result first — outside the lock, they take a while — and
 * it goes in only when they pass and the run did not move meanwhile; if it moved, it is built again. Answers what went
 * in, `undefined` when `build` had nothing to do, or the checks that failed.
 */
const changeApproved = async (
  ctx: RunContext,
  loaded: LoadedRun,
  build: (approved: ApprovedManifest) => Promise<Built | undefined>
): Promise<Built | { failed: CheckResult } | undefined> => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const approved = await readApproved(loaded.paths);
    const built = await build(approved);
    if (!built) {
      return undefined;
    }

    if (built.merged.length > 0) {
      const checks = await checkVersions(ctx, loaded, digestsOf(built.next));
      if (!checks.ok) {
        return { failed: checks };
      }
    }

    const committed = await withLock(
      loaded.paths.mergeLock,
      async () => {
        if (JSON.stringify(await readApproved(loaded.paths)) !== JSON.stringify(approved)) {
          return false;
        }

        await writeJson(loaded.paths.approved, built.next);

        return true;
      },
      { now: ctx.now }
    );
    if (committed) {
      return built;
    }
  }

  throw new RunRefusal('conflict', 'The run kept changing while this was checked: try again in a moment');
};

/**
 * An approved task's work as the run's next manifest: the one fingerprint merge between tasks. Refused, naming each file,
 * when the run's version moved and the two changes touch the same lines, or someone changed the project's file while the
 * task worked on it (unless the lead overwrites it).
 */
const buildMergeIntoRun = async (
  ctx: RunContext,
  loaded: LoadedRun,
  view: TaskView,
  start: TaskStart,
  changed: readonly string[],
  onProjectChange: ProjectChange,
  approved: ApprovedManifest
): Promise<Built> => {
  const conflicts: string[] = [];
  const outside: { file: string; mergeable: boolean }[] = [];
  const merged: string[] = [];
  const next: ApprovedManifest = { files: { ...approved.files }, tasks: [...approved.tasks, view.task.id] };
  for (const file of changed) {
    const entry = entryOf(approved.files, file);
    const from = start.files[file] ?? null;
    // The run's version moved since this copy was made — approved by another meanwhile — and the two changes are put
    // together line by line; reverted, or the same lines, is a conflict.
    let mergedText: string | undefined;
    if (entry && entry.digest !== from && entry.digest !== null) {
      const result = mergeLines(
        from === null ? '' : await textOf(loaded, ctx, from, file),
        (await readOptional(under(view.paths.work, file)))?.toString('utf-8') ?? '',
        await textOf(loaded, ctx, entry.digest, file)
      );
      if (!result.ok) {
        conflicts.push(file);
        continue;
      }

      mergedText = result.text;
      merged.push(file);
    } else if ((entry && entry.digest !== from) || (!entry && start.overlaid.includes(file))) {
      conflicts.push(file);
      continue;
    }

    // Before anything is written: the project's file as the task found it, or changed by someone while it worked.
    const knew = entry ? entry.base : from;
    const project = await fingerprint(under(ctx.root, file));
    let joined = false;
    if (project !== knew) {
      const theirs = await readOptional(under(ctx.root, file));
      const ours = mergedText ?? (await readOptional(under(view.paths.work, file)))?.toString('utf-8');
      const withProject =
        theirs === undefined || ours === undefined
          ? undefined
          : mergeLines(knew === null ? '' : await textOf(loaded, ctx, knew, file), ours, theirs.toString('utf-8'));
      if (onProjectChange === 'merge' && withProject?.ok) {
        mergedText = withProject.text;
        merged.push(file);
        joined = true;
      } else {
        outside.push({ file, mergeable: withProject?.ok === true });
        if (onProjectChange !== 'overwrite') {
          continue;
        }

        if (theirs !== undefined) {
          await putBlob(loaded.paths, theirs);
        }
      }
    }

    const bytes = mergedText === undefined ? await readOptional(under(view.paths.work, file)) : Buffer.from(mergedText);
    const digest = bytes === undefined ? null : await putBlob(loaded.paths, bytes);
    const decided = { project, by: ctx.agent, at: at(ctx) };
    next.files[file] = {
      digest,
      base: project,
      task: view.task.id,
      at: at(ctx),
      ...(project !== knew ? (joined ? { joined: decided } : { overrode: decided }) : {}),
      ...(entry ? { previous: entry } : {})
    };
  }

  if (conflicts.length > 0) {
    throw new RunRefusal(
      'conflict',
      `Task "${view.task.id}" changed the same lines of ${conflicts.join(', ')} the run has changed since its copy was made: send it back (--changes) to take the run's version (plitzi task discard <file>) and redo the change on it`,
      { task: view.task.id, files: conflicts }
    );
  }

  if (outside.length > 0 && onProjectChange !== 'overwrite') {
    const files = outside.map(each => each.file);
    const mergeable = outside.every(each => each.mergeable);
    throw new RunRefusal(
      'conflict',
      `${files.join(', ')} changed in the project while task "${view.task.id}" worked on ${files.length === 1 ? 'it' : 'them'}: nothing was merged. The lead decides — ${
        mergeable
          ? onProjectChange === 'merge'
            ? ''
            : 'the two changes go together line by line: approve with --merge (both kept, the checks run on the result), or '
          : onProjectChange === 'merge'
            ? `they touch the same lines (${outside
                .filter(each => !each.mergeable)
                .map(each => each.file)
                .join(', ')}), so --merge cannot put them together: `
            : ''
      }approve with --overwrite (the task's version is written over that change at the finish, with a notice, and the other version kept), or send it back (--changes) to take the project's version (plitzi task discard <file>) and redo the change on it`,
      {
        task: view.task.id,
        files,
        decide: [...(mergeable ? ['--merge'] : []), '--overwrite', '--changes'],
        next: `the lead decides: ${[...(mergeable ? ['--approve --merge'] : []), '--approve --overwrite', '--changes "…"'].join(', or ')}`
      }
    );
  }

  return { next, merged };
};

/**
 * A request's change as the run's next manifest, for a file nobody holds: the version it asked for, merged line by line
 * with the run's version now. Undefined when the two touch the same lines — then an integration task applies it.
 */
const buildRequestMerge = async (
  ctx: RunContext,
  loaded: LoadedRun,
  view: TaskView,
  request: SharedRequest,
  approved: ApprovedManifest
): Promise<Built | undefined> => {
  if (request.wanted === null || request.wanted === request.base) {
    return undefined;
  }

  const entry = entryOf(approved.files, request.file);
  const current = entry ? entry.digest : await fingerprint(under(ctx.root, request.file));
  if (current === null) {
    return undefined;
  }

  const result = mergeLines(
    request.base === null ? '' : await textOf(loaded, ctx, request.base, request.file),
    await textOf(loaded, ctx, request.wanted, request.file),
    await textOf(loaded, ctx, current, request.file)
  );
  if (!result.ok) {
    return undefined;
  }

  const digest = await putBlob(loaded.paths, Buffer.from(result.text));

  return {
    next: {
      ...approved,
      files: {
        ...approved.files,
        [request.file]: {
          digest,
          base: entry ? entry.base : current,
          task: view.task.id,
          at: at(ctx),
          ...(entry ? { previous: entry } : {})
        }
      }
    },
    merged: [request.file]
  };
};

/**
 * `plitzi task review`: the lead's or a reviewer's verdict on a task in review. Changes go back to the same task
 * with comments, and after the round limit to a person; approval keeps its reviewed version, merges it into the run's
 * work, lets its files go to whoever waits for them, and makes ready what was waiting on it.
 */
export const reviewTask = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  verdict: 'approve' | 'changes',
  comments: ReviewComment[],
  onProjectChange: ProjectChange = 'refuse'
): Promise<ReviewedTask> => {
  requireNoTask(ctx, 'review a task');
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'review a task');
  const task = findTask(loaded, taskId);
  const view = await viewTask(loaded.paths, task);
  // After the round limit it went to a person, who looks at it and may approve it as it is — confirming, as a person.
  const atPerson = view.state.status === 'blocked' && view.state.blockedBy?.review === true;
  if (atPerson && verdict === 'approve') {
    await requirePerson(ctx, runId, `approve task "${taskId}" after its review rounds`);
  } else if (view.state.status !== 'in-review') {
    throw new RunRefusal(
      'invalid',
      atPerson
        ? `Task "${taskId}" went to a person after its review rounds: a person approves it as it is, or answers it (plitzi task unblock ${taskId} --answer "…")`
        : `Task "${taskId}" is ${view.state.status}, not in review`,
      { task: taskId }
    );
  }

  // A question it asked the lead and the lead has not answered: the answer may change the work, so it comes first.
  const answered = new Set((await messagesOf(loaded)).flatMap(message => (message.replyTo ? [message.replyTo] : [])));
  const open = (await messagesOf(loaded)).filter(
    message => message.from === taskId && message.to === LEAD && !message.fyi && !answered.has(message.id)
  );
  if (verdict === 'approve' && open.length > 0) {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}" asked ${open.map(message => `${message.id} ("${message.text.slice(0, 80)}${message.text.length > 80 ? '…' : ''}")`).join(', ')} and it is not answered: answer it first (plitzi task message ${taskId} "…" --reply-to ${open[0].id}) — if the answer changes the work, send it back (--changes) with it`,
      { task: taskId, questions: open.map(message => message.id) }
    );
  }

  if (verdict === 'changes' && comments.length === 0) {
    throw new RunRefusal('invalid', 'Changes are asked for with what to change: --changes "…"');
  }

  const start = await readStart(view.paths);
  if (!start) {
    throw new RunRefusal('invalid', `Task "${taskId}"'s copy is gone: reassign it (plitzi task reassign ${taskId})`);
  }

  const round = view.state.round + 1;
  const changed = view.state.changed ?? [];
  await writeJson(view.paths.reviewed, {
    round,
    at: at(ctx),
    files: await keepFiles(loaded.paths, view.paths.work, changed)
  });
  await writeJson(view.paths.review, { round, verdict, comments, by: ctx.agent, at: at(ctx) });

  if (verdict === 'changes') {
    const toPerson = round >= DEFAULTS.reviewRounds;
    // It redoes its work on the run as it is now: what was approved while it was in review comes into its copy.
    const brought = toPerson ? [] : await refreshCopy(ctx, loaded, view);
    await updateState(
      view.paths,
      state => ({
        ...state,
        round,
        status: toPerson ? 'blocked' : 'changes-requested',
        ...(toPerson
          ? {
              blockedBy: {
                reason: `${String(round)} rounds of changes: a person looks at it — approves it as it is (plitzi task review ${taskId} --approve), or answers it (plitzi task unblock ${taskId} --answer "…")`,
                needs: 'person' as const,
                review: true
              }
            }
          : {}),
        notes: [
          ...state.notes,
          ...comments.map(comment => ({
            at: at(ctx),
            by: ctx.agent,
            text: `Review ${String(round)}: ${comment.note}`
          })),
          ...(brought.length > 0
            ? [
                {
                  at: at(ctx),
                  by: 'plitzi',
                  text: `Its copy brought what the run approved meanwhile: ${brought.join(', ')}`
                }
              ]
            : [])
        ]
      }),
      ctx.now
    );
    await logRun(ctx, loaded.paths, { action: 'review', task: taskId, verdict, round });

    return { verdict, round, toPerson };
  }

  const into = await changeApproved(ctx, loaded, approved =>
    buildMergeIntoRun(ctx, loaded, view, start, changed, onProjectChange, approved)
  ).catch(async (error: unknown) => {
    if (error instanceof RunRefusal && error.code === 'conflict') {
      await recordBrake(ctx, loaded, 'conflict');
    }

    throw error;
  });
  if (into && 'failed' in into) {
    throw new RunRefusal(
      'conflict',
      `Task "${taskId}"'s change, put together with the run's newer version, fails the project's checks: nothing was merged — send it back (--changes) to redo it on the run's version`,
      { task: taskId, steps: into.failed.steps.filter(step => !step.ok) }
    );
  }

  const merged = [...changed];
  // What it asked for on a file it then held and merged itself is done; what it asked for on a file now free goes in too
  // when it merges line by line with the run's version. Only what neither can do waits for an integration task.
  const locksNow = await allLocks(ctx);
  const fulfilled: string[] = [];
  for (const request of await readRequests(view.paths)) {
    const free = !(locksNow.get(request.file) ?? []).some(
      each => each.live && !(each.run === runId && each.task === taskId)
    );
    const went =
      !merged.includes(request.file) && free
        ? await changeApproved(ctx, loaded, approved => buildRequestMerge(ctx, loaded, view, request, approved))
        : undefined;
    const done = merged.includes(request.file) || (went !== undefined && !('failed' in went));
    if (done) {
      await fs.rm(path.join(view.paths.requests, `${request.id}.json`), { force: true });
      fulfilled.push(request.file);
    }
  }

  const released = [...(await lockedFiles(view.paths)).keys()];
  await fs.rm(view.paths.locks, { recursive: true, force: true });
  await revokeOwner(view.paths);
  await updateState(view.paths, state => ({ ...state, round, status: 'done' }), ctx.now);
  await fs.rm(view.paths.cache, { recursive: true, force: true });

  const refreshed = await loadRun(ctx, runId);
  const granted = await grantWaiters(ctx, refreshed, released);
  const settled = await settleRequests(ctx, refreshed, released);
  const states = new Map(
    await Promise.all(
      refreshed.tasks.map(async each => [each.id, (await viewTask(refreshed.paths, each)).state] as const)
    )
  );
  const ready: string[] = [];
  for (const each of refreshed.tasks) {
    if (states.get(each.id)?.status === 'pending' && dependenciesDone(each, states)) {
      await updateState(taskPaths(refreshed.paths, each.id), state => ({ ...state, status: 'ready' }), ctx.now);
      ready.push(each.id);
    }
  }

  // What is connected shows as it is approved: a running preview of the run takes the approved work in now.
  await syncPreview(refreshed, ctx.root);
  const integrations = await withLock(refreshed.paths.mergeLock, () => integrateWhenReady(ctx, refreshed), {
    now: ctx.now
  });
  await logRun(ctx, loaded.paths, {
    action: 'review',
    task: taskId,
    verdict,
    round,
    merged,
    fulfilled,
    granted,
    ready,
    integrations
  });

  const joined = Object.entries((await readApproved(loaded.paths)).files)
    .filter(([, entry]) => entry.task === taskId && entry.joined !== undefined)
    .map(([file]) => file);

  return {
    verdict,
    round,
    merged,
    granted,
    ready: [...ready, ...integrations],
    integrations,
    settled,
    ...(joined.length > 0 ? { joined } : {})
  };
};

/** `plitzi task reassign`: the lead or a person cuts a task — its holder's token revoked — for another to take. */
export const reassignTask = async (
  ctx: RunContext,
  runId: string,
  taskId: string
): Promise<{
  from?: string;
  reviewedRound?: number;
  released: string[];
  granted: string[];
  settled: string[];
  integrations: string[];
}> => {
  requireNoTask(ctx, 'reassign a task');
  const loaded = await loadRun(ctx, runId);
  const task = findTask(loaded, taskId);
  const view = await viewTask(loaded.paths, task);
  if (view.state.status === 'done') {
    throw new RunRefusal('invalid', `Task "${taskId}" is done: revert it instead (plitzi task revert ${taskId})`);
  }

  // What it held by turns is let go with it — handed to whoever waits, its requests merged — not left until its locks
  // run out half an hour after its agent went quiet.
  const turns = [...(await lockedFiles(view.paths))].filter(([, lock]) => lock.kind === 'turn').map(([file]) => file);
  await cutTask(view, `reassigned by ${ctx.agent}`, ctx.now);
  const refreshed = await loadRun(ctx, runId);
  const granted = await grantWaiters(ctx, refreshed, turns);
  const settled = await settleRequests(ctx, refreshed, turns);
  const integrations = await withLock(refreshed.paths.mergeLock, () => integrateWhenReady(ctx, refreshed), {
    now: ctx.now
  });
  await logRun(ctx, loaded.paths, {
    action: 'reassign',
    task: taskId,
    from: view.owner?.agent,
    released: turns,
    granted,
    settled,
    integrations
  });

  return {
    ...(view.owner ? { from: view.owner.agent } : {}),
    ...(view.reviewed ? { reviewedRound: view.reviewed.round } : {}),
    released: turns,
    granted,
    settled,
    integrations
  };
};

/**
 * `plitzi task revert`: what one approved task brought into the run's work taken back out, before the final merge — the
 * others' untouched. A file another task changed after it is not reverted, and is said.
 */
export const revertTask = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  reason?: string
): Promise<{ reverted: string[]; kept: string[]; dependants: string[]; waiting: string[] }> => {
  requireNoTask(ctx, 'revert a task');
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping', 'stopped'], 'revert a task');
  const task = findTask(loaded, taskId);
  const view = await viewTask(loaded.paths, task);
  if (view.state.status !== 'done') {
    throw new RunRefusal('invalid', `Task "${taskId}" is ${view.state.status}: only an approved task is reverted`);
  }

  const reverted: string[] = [];
  const kept: string[] = [];
  await withLock(
    loaded.paths.mergeLock,
    async () => {
      const approved = await readApproved(loaded.paths);
      const files: Record<string, ApprovedFile> = {};
      for (const [file, entry] of Object.entries(approved.files)) {
        if (entry.task === taskId) {
          if (entry.previous) {
            files[file] = entry.previous;
          }

          reverted.push(file);
          continue;
        }

        let previous = entry.previous;
        while (previous) {
          if (previous.task === taskId) {
            kept.push(file);
            break;
          }

          previous = previous.previous;
        }

        files[file] = entry;
      }

      await writeJson(loaded.paths.approved, { files, tasks: approved.tasks.filter(id => id !== taskId) });
    },
    { now: ctx.now }
  );
  await fs.rm(view.paths.reviewed, { force: true });
  await updateState(
    view.paths,
    state => ({
      ...state,
      status: 'ready',
      round: 0,
      notes: [
        ...state.notes,
        {
          at: at(ctx),
          by: ctx.agent,
          text: `Reverted${reason ? ` — ${reason}` : ''}: ${reverted.join(', ') || 'nothing'}`
        }
      ]
    }),
    ctx.now
  );
  // Whoever takes it again hears why, with its take: what to redo, not only that it is to be redone.
  if (reason) {
    await sendMessage(ctx, loaded, {
      from: LEAD,
      to: taskId,
      text: `This task was reverted and is to be done again: ${reason}`
    });
  }
  // What was built on it waits for it again: not started, it goes back to pending; in hand, its agent is told.
  const dependants = loaded.tasks.filter(each => each.dependsOn.includes(taskId));
  const waiting: string[] = [];
  for (const dependant of dependants) {
    const dependantView = await viewTask(loaded.paths, dependant);
    if (dependantView.state.status === 'done') {
      continue;
    }

    const notStarted = !dependantView.owner && dependantView.state.status === 'ready';
    await updateState(
      dependantView.paths,
      state => ({
        ...state,
        ...(notStarted ? { status: 'pending' as const } : {}),
        notes: [
          ...state.notes,
          {
            at: at(ctx),
            by: 'plitzi',
            text: notStarted
              ? `"${taskId}", which it depends on, was reverted: it waits for it again`
              : `"${taskId}", which it depends on, was reverted (${reverted.join(', ') || 'nothing'}): what it builds on is not in the run any more`
          }
        ]
      }),
      ctx.now
    );
    if (notStarted) {
      waiting.push(dependant.id);
    }
  }

  await syncPreview(await loadRun(ctx, runId), ctx.root);
  await logRun(ctx, loaded.paths, { action: 'revert', task: taskId, reverted, kept, waiting });

  return { reverted, kept, dependants: dependants.map(each => each.id), waiting };
};

export interface TaskContext {
  task: RunTask;
  state: TaskState;
  holder?: string;
  review?: { round: number; verdict: string; comments: ReviewComment[] };
  /** For an integration task: each request with the requester's version against the run's now. */
  requests: { task: string; file: string; summary: string; usedIn: string[]; diff?: string; notes: string[] }[];
  related: { task: string; title: string; status: string; changed: string[]; notes: string[] }[];
  contracts: { resource: string; owner: string; note: string }[];
  /** What it was proposed and proposed, and what it agreed to with other tasks — what its review checks too. */
  proposals: { incoming: ProposalView[]; outgoing: ProposalView[]; agreements: ProposalView[] };
  /** The project's own notes (`NOTES.md`): how something is built here, what must not be undone. */
  projectNotes?: string;
  /** The run's notes to every task (`run note`, the plan's `notes`): what holds for the whole run. */
  runNotes: string[];
  /** Each of the task's files — from its copy while it holds one, else the run's — as text when it is text and small. */
  /** `toCreate`: a file of the task's that does not exist yet — it is the task's to write. */
  files: { file: string; from: 'copy' | 'run'; text?: string; bytes?: number; toCreate?: boolean }[];
}

const MAX_CONTEXT_FILE = 64 * 1024;

/** A request's key, `<task>/<request>`, as its two names. */
const requestKey = (key: string): [string, string] => {
  const [requester = '', name = ''] = key.split('/');

  return [requester, name];
};

/** How many of a task's notes a context hands on: the latest, which say where it stands — not every turn it waited. */
const CONTEXT_NOTES = 5;

const lastNotes = (view: TaskView): string[] => view.state.notes.slice(-CONTEXT_NOTES).map(note => note.text);

const textOf = async (loaded: LoadedRun, ctx: RunContext, digest: string | null, file: string): Promise<string> => {
  if (digest === null) {
    return '';
  }

  const bytes = await getBlob(loaded.paths, digest).catch(() => readOptional(under(ctx.root, file)));

  return bytes?.toString('utf-8') ?? '';
};

/**
 * `plitzi task context`: what a task needs and nothing more, so its context stays small — the requests and their
 * diffs (an integration's), what related tasks did and noted, the plan's contracts, the project's and the run's notes, and its files.
 */
export const taskContext = async (ctx: RunContext, runId: string, taskId: string): Promise<TaskContext> => {
  const loaded = await loadRun(ctx, runId, { anyVersion: true });
  const task = findTask(loaded, taskId);
  const view = await viewTask(loaded.paths, task);
  const approved = await readApproved(loaded.paths);
  const requests: TaskContext['requests'] = [];
  // An integration task's requests are the ones it applies; any other task's, the ones it made.
  const asked: [string, string][] = task.integrates
    ? task.integrates.map(requestKey)
    : view.requests.map(request => [task.id, request.id]);
  for (const [requester, name] of asked) {
    const requesterView = requester === task.id ? view : await viewTask(loaded.paths, findTask(loaded, requester));
    const request = requesterView.requests.find(each => each.id === name);
    if (!request) {
      continue;
    }

    // What the task changed: from the version it started from to the one it asks for — not against the file now.
    const before = await textOf(loaded, ctx, request.base, request.file);
    const wanted = await textOf(loaded, ctx, request.wanted, request.file);
    const diff = before === wanted ? undefined : unifiedDiff(request.file, before, wanted);
    requests.push({
      task: requester,
      file: request.file,
      summary: request.summary,
      usedIn: request.usedIn,
      ...(diff ? { diff } : {}),
      notes: lastNotes(requesterView)
    });
  }

  const relatedIds = new Set([...task.dependsOn, ...requests.map(request => request.task)]);
  const related: TaskContext['related'] = [];
  for (const id of relatedIds) {
    const other = await viewTask(loaded.paths, findTask(loaded, id));
    related.push({
      task: id,
      title: other.task.title,
      status: other.state.status,
      changed: other.state.changed ?? [],
      notes: lastNotes(other)
    });
  }

  // Its files as it works on them: its copy's while it holds one, the run's otherwise.
  const copy = view.owner !== undefined && (await readStart(view.paths)) !== undefined;
  const files: TaskContext['files'] = [];
  for (const file of task.files) {
    const current = await currentVersion(ctx, approved, file);
    let bytes: Buffer | undefined;
    if (copy) {
      bytes = await readOptional(under(view.paths.work, file));
    } else if (current.digest !== null) {
      bytes = current.fromProject
        ? await readOptional(under(ctx.root, file))
        : await getBlob(loaded.paths, current.digest);
    }

    const from = copy ? 'copy' : 'run';
    if (bytes === undefined) {
      files.push({ file, from, toCreate: true });
    } else if (bytes.length <= MAX_CONTEXT_FILE && !bytes.includes(0)) {
      files.push({ file, from, text: bytes.toString('utf-8') });
    } else {
      files.push({ file, from, bytes: bytes.length });
    }
  }

  const projectNotes = (await readOptional(under(ctx.root, PROJECT_NOTES)))?.toString('utf-8');
  const proposals = await proposalsOf(loaded);

  return {
    task,
    state: view.state,
    ...(view.owner ? { holder: view.owner.agent } : {}),
    ...(view.review
      ? { review: { round: view.review.round, verdict: view.review.verdict, comments: view.review.comments } }
      : {}),
    requests,
    related,
    contracts: loaded.plan.contracts ?? [],
    proposals: {
      incoming: proposals.filter(each => each.to === taskId),
      outgoing: proposals.filter(each => each.from === taskId),
      agreements: agreementsOf(proposals, taskId)
    },
    ...(projectNotes !== undefined ? { projectNotes } : {}),
    runNotes: (await runNotesOf(loaded)).map(note => note.text),
    files
  };
};

/** Whether `task` holds a signal: for `plitzi run watch`'s "no signal" line. */
export const withoutSignal = (view: TaskView, now: Date): boolean =>
  view.owner !== undefined && isDisconnected(view.task, view.signalAt, now);
