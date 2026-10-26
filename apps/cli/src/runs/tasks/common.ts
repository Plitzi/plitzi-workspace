import fs from 'node:fs/promises';
import path from 'node:path';

import { LINT_CACHE_FILE } from '../../scaffold/paths';
import { fingerprint, projectFiles, readOptional, writeJson } from '../files';
import { mergeLines } from '../merge3';
import { entryOf } from '../model';
import { projectPath, under } from '../paths';
import { RunRefusal } from '../refusal';
import { readApproved } from '../run';
import { getBlob, placeVersion, putBlob } from '../store';
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
      `This is the command of whoever holds task "${task.id}": run it in its copy, with your own token (--token)`,
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
        `That token is not one task "${task.id}" was taken with: plitzi task next <task> answers its token`,
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

  // The copy says the task to its holder alone (`contextFor`); held here too, so no caller acts on a task it did not
  // take — a person at its terminal excepted.
  if (ctx.agent !== 'person' && view.owner.agent !== ctx.agent) {
    throw new RunRefusal('identity', `Task "${task.id}" is ${view.owner.agent}'s, not ${ctx.agent}'s`, {
      task: task.id,
      agent: view.owner.agent
    });
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
 * A shared file the task changed, and the run changed since the copy was made: both changes put together in the copy,
 * line by line, from where the copy started — when they meet nowhere. Answers whether it did; a clash is left for
 * `complete` to say.
 */
const mergedInCopy = async (
  ctx: RunContext,
  loaded: LoadedRun,
  approved: ApprovedManifest,
  view: TaskView,
  file: string,
  startedFrom: string | null
): Promise<boolean> => {
  const current = await currentVersion(ctx, approved, file);
  if (startedFrom === null || current.digest === null || current.digest === startedFrom) {
    return false;
  }

  const base = await getBlob(loaded.paths, startedFrom).catch(() => undefined);
  const ours = await readOptional(under(view.paths.work, file));
  const theirs = current.fromProject
    ? await readOptional(under(ctx.root, file))
    : await getBlob(loaded.paths, current.digest).catch(() => undefined);
  if (!base || !ours || !theirs || [base, ours, theirs].some(bytes => bytes.includes(0))) {
    return false;
  }

  const merged = mergeLines(base.toString('utf-8'), ours.toString('utf-8'), theirs.toString('utf-8'));
  if (!merged.ok) {
    return false;
  }

  await fs.writeFile(under(view.paths.work, file), merged.text);

  return true;
};

/**
 * Brings a task's copy up to the run: every file the run approved since the copy was made — or that `file` names — put
 * in, unless the task changed it itself; and a file of the project a person changed since, that no task's approval
 * holds and this task does not own (the data formatted mid-run failed every older copy's checks, and braked
 * the run twice). A changed file is told by its time first: the copy is not read whole at each call. A file handed on by turns arrives with what it imports, approved after the copy
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
  const copiedAt = Date.parse(start.copiedAt);
  const own = new Set(view.task.files);
  const editedInProject: string[] = [];
  for (const [each, digest] of Object.entries(start.files)) {
    if (own.has(each) || entryOf(approved.files, each)) {
      continue;
    }

    const stat = await fs.stat(under(ctx.root, each)).catch(() => undefined);
    if (stat ? stat.mtimeMs > copiedAt : digest !== null) {
      editedInProject.push(each);
    }
  }

  const candidates = new Set([...Object.keys(approved.files), ...editedInProject, ...(file ? [file] : [])]);
  for (const each of candidates) {
    const inCopy = await fingerprint(under(view.paths.work, each));
    const startedFrom = files[each] ?? null;
    // The task's own change stays: only what it did not touch is brought, and `file` when it is asked for by name — but a
    // shared file both it and the run changed is put together line by line now, as `complete` will: its checks run on
    // what is merged (t-sponsors' theme.ts lacked the run's new token, and author failed in its copy).
    if (each !== file && inCopy !== startedFrom) {
      if (!own.has(each) && (await mergedInCopy(ctx, loaded, approved, view, each, startedFrom))) {
        files[each] = (await currentVersion(ctx, approved, each)).digest;
        brought.push(each);
      }

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
        await placeVersion(
          loaded.paths,
          under(view.paths.work, each),
          await putBlob(loaded.paths, bytes),
          view.paths.work
        );
      }

      overlaid.delete(each);
    } else {
      await placeVersion(loaded.paths, under(view.paths.work, each), current.digest, view.paths.work);
      overlaid.add(each);
    }

    files[each] = current.digest;
    brought.push(each);
  }

  await writeJson(view.paths.start, { ...start, files, overlaid: [...overlaid].sort() });
  // ESLint keeps its answers file by file: a file brought in — a token, a type — changes what the files reading it
  // fail with, and the kept answer said the old errors (an agent deleted tmp/plitzi-cache/checks/eslint.json
  // by hand to see its copy lint clean).
  if (brought.length > 0) {
    await fs.rm(path.join(view.paths.work, LINT_CACHE_FILE), { force: true });
  }

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
    const served = start.served?.[file];
    if (served) {
      // Cloned unread: told changed by its size or its time, never read whole.
      const stat = await fs.stat(under(view.paths.work, file));
      if (stat.size !== served.size || stat.mtimeMs !== served.mtimeMs) {
        changed.add(file);
      }

      continue;
    }

    if ((await fingerprint(under(view.paths.work, file))) !== (start.files[file] ?? null)) {
      changed.add(file);
    }
  }

  for (const file of Object.keys(start.served ?? {})) {
    if (!inCopy.includes(file)) {
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
