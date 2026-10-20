import { fingerprint, readOptional, writeJson } from '../files';
import { checkVersions } from '../materialise';
import { mergeLines } from '../merge3';
import { entryOf } from '../model';
import { under } from '../paths';
import { RunRefusal } from '../refusal';
import { readApproved } from '../run';
import { putBlob, withLock } from '../store';
import { at } from './common';
import { textOf } from './context';

import type { CheckResult } from '../checks';
import type { ApprovedManifest, ProjectChange, SharedRequest, TaskStart } from '../model';
import type { LoadedRun, RunContext } from '../run';
import type { TaskView } from '../taskStore';

/**
 * What an approval writes into the run's work: a task's files, or a request's, merged with what the run holds — under
 * the run's merge lock, with the project's checks over the result.
 */

interface Built {
  next: ApprovedManifest;
  /** Files put together line by line with the run's newer version: what the checks look at before it goes in. */
  merged: string[];
}

export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const digestsOf = (manifest: ApprovedManifest): Record<string, string | null> =>
  Object.fromEntries(Object.entries(manifest.files).map(([file, entry]) => [file, entry.digest]));

/**
 * Changes the run's approved work. `build` makes the next manifest from the one there is; when it merged a file with the
 * run's newer version, the project's checks run over the whole result first — outside the lock, they take a while — and
 * it goes in only when they pass and the run did not move meanwhile; if it moved, it is built again. Answers what went
 * in, `undefined` when `build` had nothing to do, or the checks that failed.
 */
export const changeApproved = async (
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
export const buildMergeIntoRun = async (
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
export const buildRequestMerge = async (
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
