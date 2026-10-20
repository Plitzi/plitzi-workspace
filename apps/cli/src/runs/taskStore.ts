import fs from 'node:fs/promises';
import path from 'node:path';

import { filesUnder, newestWrite, readJson, writeJson } from './files';
import {
  isFileLock,
  isReviewedVersion,
  isRunTask,
  isSharedRequest,
  isTaskOwner,
  isTaskProgress,
  isTaskReview,
  isTaskStart,
  isTaskState
} from './model';
import { taskPaths, tasksDir } from './paths';
import { withLock } from './store';

import type {
  FileLock,
  ReviewedVersion,
  RunTask,
  SharedRequest,
  TaskOwner,
  TaskProgress,
  TaskReview,
  TaskStart,
  TaskState
} from './model';
import type { RunPaths, TaskPaths } from './paths';

/** The run's defaults: few subagents, long tasks — a slow task is not a dead one, and no timer cuts one alive. */
export const DEFAULTS = {
  /** Without a write, progress, heartbeat or command for this long — or 25 % of its estimate, if longer — a task has no signal. */
  noSignalMs: 15 * 60_000,
  /** A lock lasts while its task has a signal, and this long after it lost it. */
  lockAfterSignalMs: 30 * 60_000,
  /** A run's caches are purged after this long without activity; its essentials stay. */
  cacheIdleMs: 8 * 60 * 60_000,
  /** What every run's caches may hold together; the oldest go first, said. */
  cacheCapBytes: 1024 * 1024 * 1024,
  reviewRounds: 3,
  /** The automatic brake: within this window, more than `failures` failed checks or conflicts, or this share refused. */
  brakeWindowMs: 30 * 60_000,
  brakeFailures: 5,
  brakeRefusedShare: 0.2,
  /** Completions and refusals the share is judged over, at least: two refusals among a handful say nothing yet. */
  brakeMinSample: 10
} as const;

export interface TaskView {
  task: RunTask;
  paths: TaskPaths;
  state: TaskState;
  owner?: TaskOwner;
  progress?: TaskProgress;
  review?: TaskReview;
  reviewed?: ReviewedVersion;
  locks: FileLock[];
  requests: SharedRequest[];
  /** The last sign of life of whoever holds it, in ms since the epoch. */
  signalAt?: number;
}

export const readTask = async (run: RunPaths, taskId: string): Promise<RunTask | undefined> =>
  readJson(taskPaths(run, taskId).definition, isRunTask, 'a task of the run');

export const readTasks = async (run: RunPaths): Promise<RunTask[]> => {
  const entries = await fs.readdir(tasksDir(run), { withFileTypes: true }).catch(() => []);
  const tasks: RunTask[] = [];
  for (const entry of entries.filter(each => each.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const task = await readTask(run, entry.name);
    if (task) {
      tasks.push(task);
    }
  }

  return tasks;
};

export const readState = async (task: TaskPaths): Promise<TaskState> => {
  const state = await readJson(task.state, isTaskState, 'a task’s state');
  if (!state) {
    throw new Error(`${task.state} is missing: the run's folder was changed outside the CLI`);
  }

  return state;
};

/** Changes a task's state under its own lock: two commands on one task never lose each other's change. */
export const updateState = async (
  task: TaskPaths,
  change: (state: TaskState) => TaskState,
  now: () => Date
): Promise<TaskState> =>
  withLock(
    task.stateLock,
    async () => {
      const next = { ...change(await readState(task)), updatedAt: now().toISOString() };
      await writeJson(task.state, next);

      return next;
    },
    { now }
  );

export const readOwner = (task: TaskPaths): Promise<TaskOwner | undefined> =>
  readJson(task.owner, isTaskOwner, 'who holds a task (owner.json)');

/** Takes a task's token away: whoever held it can no longer write as it. */
export const revokeOwner = async (task: TaskPaths): Promise<void> => {
  await fs.rm(task.owner, { force: true });
};

export const readProgress = (task: TaskPaths): Promise<TaskProgress | undefined> =>
  readJson(task.progress, isTaskProgress, 'a task’s progress');

export const readReview = (task: TaskPaths): Promise<TaskReview | undefined> =>
  readJson(task.review, isTaskReview, 'a task’s review');

export const readReviewed = (task: TaskPaths): Promise<ReviewedVersion | undefined> =>
  readJson(task.reviewed, isReviewedVersion, 'a task’s reviewed version');

export const readStart = (task: TaskPaths): Promise<TaskStart | undefined> =>
  readJson(task.start, isTaskStart, 'what a task’s copy started from');

/** The files a task's `.lock`s reserve, by project path, with each lock. */
export const lockedFiles = async (task: TaskPaths): Promise<Map<string, FileLock>> => {
  const held = new Map<string, FileLock>();
  for (const file of await filesUnder(task.locks)) {
    if (!file.endsWith('.lock')) {
      continue;
    }

    const lock = await readJson(path.join(task.locks, ...file.split('/')), isFileLock, 'a .lock');
    if (lock) {
      held.set(file.slice(0, -'.lock'.length), lock);
    }
  }

  return held;
};

export const readLocks = async (task: TaskPaths): Promise<FileLock[]> => [...(await lockedFiles(task)).values()];

export const readRequests = async (task: TaskPaths): Promise<SharedRequest[]> => {
  const entries = await fs.readdir(task.requests).catch(() => []);
  const requests: SharedRequest[] = [];
  for (const entry of entries.filter(name => name.endsWith('.json')).sort()) {
    const request = await readJson(path.join(task.requests, entry), isSharedRequest, 'a request on a shared file');
    if (request) {
      requests.push(request);
    }
  }

  return requests;
};

/** A request's file name: the shared file it is on, as one name. */
export const requestId = (file: string): string => file.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');

export const writeRequest = (task: TaskPaths, request: SharedRequest): Promise<void> =>
  writeJson(path.join(task.requests, `${request.id}.json`), request);

/** The last sign of life of whoever holds a task: its commands, its progress and heartbeats, its writes in its copy. */
export const signalOf = async (
  task: RunTask,
  paths: TaskPaths,
  state: TaskState,
  owner: TaskOwner | undefined,
  progress: TaskProgress | undefined
): Promise<number | undefined> => {
  if (!owner) {
    return undefined;
  }

  const written = await newestWrite(paths.work, task.files);
  const times = [Date.parse(owner.takenAt), Date.parse(state.updatedAt), written ?? 0];
  if (progress) {
    times.push(Date.parse(progress.heartbeatAt));
  }

  return Math.max(...times.filter(time => Number.isFinite(time)));
};

/** How long a task can go without a signal before it counts as disconnected. */
export const noSignalAfter = (task: RunTask): number =>
  Math.max(DEFAULTS.noSignalMs, task.estimateMinutes * 60_000 * 0.25);

export const isDisconnected = (task: RunTask, signalAt: number | undefined, now: Date): boolean =>
  signalAt !== undefined && now.getTime() - signalAt > noSignalAfter(task);

/** Whether a task's locks have run out: it lost its signal, and the time a lock outlives that has passed. */
export const locksExpired = (task: RunTask, signalAt: number | undefined, now: Date): boolean =>
  signalAt === undefined || now.getTime() - signalAt > noSignalAfter(task) + DEFAULTS.lockAfterSignalMs;

export const viewTask = async (run: RunPaths, task: RunTask): Promise<TaskView> => {
  const paths = taskPaths(run, task.id);
  const state = await readState(paths);
  const owner = await readOwner(paths);
  const progress = await readProgress(paths);
  const review = await readReview(paths);
  const reviewed = await readReviewed(paths);
  const signalAt = await signalOf(task, paths, state, owner, progress);

  return {
    task,
    paths,
    state,
    ...(owner ? { owner } : {}),
    ...(progress ? { progress } : {}),
    ...(review ? { review } : {}),
    ...(reviewed ? { reviewed } : {}),
    locks: await readLocks(paths),
    requests: await readRequests(paths),
    ...(signalAt !== undefined ? { signalAt } : {})
  };
};

/** One line of a task's log: what it did, when, and with what result — the audit of what each task wrote. */
export const appendLog = async (file: string, entry: Record<string, unknown>): Promise<void> => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(entry)}\n`);
};

/**
 * Cuts a task: its token revoked, its locks let go, its copy discarded — what it wrote since its last review is not
 * resumed, as the next agent would not have the context it was written in. It goes back to ready, saying where and why.
 */
export const cutTask = async (view: TaskView, reason: string, now: () => Date): Promise<void> => {
  await revokeOwner(view.paths);
  await fs.rm(view.paths.locks, { recursive: true, force: true });
  // Its copy is left where it is, not removed under an agent that may be mid-command in it: a `cd` into a folder gone
  // would run the rest of the command wherever the shell was. Its token is revoked, so nothing of it is ever merged, and
  // the next take makes a new copy in its place.
  const step = view.progress?.step ?? view.state.status;
  await updateState(
    view.paths,
    state => ({
      ...state,
      status: 'ready',
      cutAt: { step, reason, at: now().toISOString() },
      notes: [
        ...state.notes,
        {
          at: now().toISOString(),
          by: 'plitzi',
          text: `Cut at "${step}": ${reason}. ${view.reviewed ? `It starts again from the version its review ${String(view.reviewed.round)} saw` : 'It was never reviewed: it starts from scratch'}.`
        }
      ],
      waitingFor: undefined
    }),
    now
  );
};
