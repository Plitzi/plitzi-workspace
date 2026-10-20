import fs from 'node:fs/promises';

import { fingerprint, projectFiles, readOptional, writeJson } from '../files';
import { entryOf } from '../model';
import { projectPath, under } from '../paths';
import { RunRefusal } from '../refusal';
import { readApproved } from '../run';
import { placeVersion, putBlob } from '../store';
import { isDisconnected, readStart, revokedTokens, tokenPrint, viewTask } from '../taskStore';

import type { ApprovedManifest, RunTask, TaskStart } from '../model';
import type { LoadedRun, RunContext } from '../run';
import type { TaskView } from '../taskStore';

/**
 * What every step of a task's life reads: the task, who holds it, the run's version of a file, and its copy brought
 * up to date with what the run approved.
 */

export const at = (ctx: RunContext): string => ctx.now().toISOString();

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
    // Never this task's: a token of another — its secret under this task's name — is not one that was cut.
    if (!(await revokedTokens(view.paths)).includes(tokenPrint(ctx.token))) {
      throw new RunRefusal(
        'invalid',
        `That token is not one task "${task.id}" was taken with: plitzi task take answers its token`,
        {
          task: task.id
        }
      );
    }

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

/** The run's version of a file now: its approved work over the project. */
export const currentVersion = async (
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
export const refreshCopy = async (
  ctx: RunContext,
  loaded: LoadedRun,
  view: TaskView,
  file?: string
): Promise<string[]> => {
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

/** Whether `task` holds a signal: for `plitzi run watch`'s "no signal" line. */
export const withoutSignal = (view: TaskView, now: Date): boolean =>
  view.owner !== undefined && isDisconnected(view.task, view.signalAt, now);

/** What a task's copy changed against where it started, by project path: what is not the source left out. */
export const changedInCopy = async (view: TaskView, start: TaskStart): Promise<string[]> => {
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
