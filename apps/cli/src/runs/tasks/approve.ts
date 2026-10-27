import { at } from './common';
import { textOf } from './context';
import { checkVersions } from '../copies/materialise';
import { mergeLines } from '../copies/merge3';
import { fingerprint, readOptional, writeJson } from '../core/files';
import { entryOf } from '../core/model';
import { under } from '../core/paths';
import { RunRefusal } from '../core/refusal';
import { getBlob, putBlob, withLock } from '../core/store';
import { readApproved } from '../run';

import type { CheckResult } from '../copies/checks';
import type { ApprovedManifest, ProjectChange, SharedRequest, TaskStart } from '../core/model';
import type { TaskView } from '../core/taskStore';
import type { LoadedRun, RunContext } from '../run';

/**
 * What an approval writes into the run's work: a task's files, or a request's, merged with what the run holds — under
 * the run's merge lock, with the project's checks over the result.
 */

interface Built {
  next: ApprovedManifest;
  /** Files put together line by line with the run's newer version: what the checks look at before it goes in. */
  merged: string[];
  /** Of the requests it was built from, those that went in, as `<task>/<request>`: the rest did not merge line by line. */
  requests?: string[];
}

/** A request of a task's on a shared file: what a build of requests merges. */
export interface Asked {
  view: TaskView;
  request: SharedRequest;
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
  build: (approved: ApprovedManifest) => Promise<Built | undefined>,
  /**
   * Checked whatever it merged: files new to the run go in unchecked otherwise — a run's t-shell put its shell in
   * without the site.json keys and tokens it read, and every copy after failed typecheck.
   */
  { checkAlways = false }: { checkAlways?: boolean } = {}
): Promise<Built | { failed: CheckResult } | undefined> => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const approved = await readApproved(loaded.paths);
    const built = await build(approved);
    if (!built) {
      return undefined;
    }

    if (built.merged.length > 0 || checkAlways) {
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
  submitted: Readonly<Record<string, string | null>>,
  onProjectChange: ProjectChange,
  approved: ApprovedManifest
): Promise<Built> => {
  const conflicts: string[] = [];
  const created: { file: string; by: string }[] = [];
  const outside: { file: string; mergeable: boolean }[] = [];
  const merged: string[] = [];
  const next: ApprovedManifest = { files: { ...approved.files }, tasks: [...approved.tasks, view.task.id] };
  // What went to review, never the copy as it is now: its agent may have written in it since.
  const ours = async (file: string): Promise<Buffer | undefined> => {
    const digest = Object.hasOwn(submitted, file) ? submitted[file] : null;

    return digest === null ? undefined : getBlob(loaded.paths, digest);
  };
  for (const file of Object.keys(submitted)) {
    const entry = entryOf(approved.files, file);
    const from = start.files[file] ?? null;
    // The run's version moved since this copy was made — approved by another meanwhile — and the two changes are put
    // together line by line; reverted, or the same lines, is a conflict.
    let mergedText: string | undefined;
    // A file this task made where another task made one meanwhile: two files by one name, not two edits of one — the
    // lead decides, never a merge of the two.
    if (from === null && entry && entry.digest !== null && entry.task !== view.task.id) {
      created.push({ file, by: entry.task });
      continue;
    }

    if (entry && entry.digest !== from && entry.digest !== null) {
      const result = mergeLines(
        from === null ? '' : await textOf(loaded, ctx, from, file),
        (await ours(file))?.toString('utf-8') ?? '',
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
      const mine = mergedText ?? (await ours(file))?.toString('utf-8');
      const withProject =
        theirs === undefined || mine === undefined
          ? undefined
          : mergeLines(knew === null ? '' : await textOf(loaded, ctx, knew, file), mine, theirs.toString('utf-8'));
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

    const bytes = mergedText === undefined ? await ours(file) : Buffer.from(mergedText);
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

  if (created.length > 0) {
    throw new RunRefusal(
      'conflict',
      `Task "${view.task.id}" made ${created.map(each => `${each.file} (task "${each.by}" made one by that name too, approved first)`).join(', ')}: nothing was merged — send it back (plitzi task review ${view.task.id} --changes "…") to take the run's version (plitzi task discard <file>) and build on it, or to give its own file another name`,
      { task: view.task.id, files: created.map(each => each.file), madeBy: created.map(each => each.by) }
    );
  }

  if (conflicts.length > 0) {
    throw new RunRefusal(
      'conflict',
      `Task "${view.task.id}" changed the same lines of ${conflicts.join(', ')} the run has changed since its copy was made: send it back (plitzi task review ${view.task.id} --changes "…") to take the run's version (plitzi task discard <file>) and redo the change on it`,
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
            : `the two changes go together line by line: approve with plitzi task review ${view.task.id} --approve --merge (both kept, the checks run on the result), or `
          : onProjectChange === 'merge'
            ? `they touch the same lines (${outside
                .filter(each => !each.mergeable)
                .map(each => each.file)
                .join(', ')}), so a merge cannot put them together: `
            : ''
      }approve with plitzi task review ${view.task.id} --approve --overwrite (the task's version is written over that change at the finish, with a notice, and the other version kept), or send it back (plitzi task review ${view.task.id} --changes "…") to take the project's version (plitzi task discard <file>) and redo the change on it`,
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
 * Requests on shared files as the run's next manifest, together: each put together line by line with what the run holds
 * — and with the ones before it — so their checks run once over all of them. Apart, two approved tasks' requests on one
 * file each failed the checks for want of the other's (t-sponsors' and t-predictions' tokens, neither
 * ever merged, every task's check failing on both). One that does not merge is left out, said by `requests`.
 */
export const buildRequestsMerge = async (
  ctx: RunContext,
  loaded: LoadedRun,
  asked: readonly Asked[],
  approved: ApprovedManifest
): Promise<Built | undefined> => {
  let files = approved.files;
  const merged = new Set<string>();
  const went: string[] = [];
  for (const { view, request } of asked) {
    if (request.wanted === null || request.wanted === request.base) {
      continue;
    }

    const entry = entryOf(files, request.file);
    const current = entry ? entry.digest : await fingerprint(under(ctx.root, request.file));
    if (current === null) {
      continue;
    }

    const result = mergeLines(
      request.base === null ? '' : await textOf(loaded, ctx, request.base, request.file),
      await textOf(loaded, ctx, request.wanted, request.file),
      await textOf(loaded, ctx, current, request.file)
    );
    if (!result.ok) {
      continue;
    }

    const digest = await putBlob(loaded.paths, Buffer.from(result.text));
    files = {
      ...files,
      [request.file]: {
        digest,
        base: entry ? entry.base : current,
        task: view.task.id,
        at: at(ctx),
        ...(entry ? { previous: entry } : {})
      }
    };
    merged.add(request.file);
    went.push(`${view.task.id}/${request.id}`);
  }

  return went.length === 0 ? undefined : { next: { ...approved, files }, merged: [...merged], requests: went };
};
