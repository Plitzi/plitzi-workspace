import fs from 'node:fs/promises';
import path from 'node:path';

import { unifiedDiff } from '../../fix/diff';
import { checkAcceptance } from '../acceptance';
import { proposalsOf, unansweredTo } from '../agreements';
import { failsWithout } from '../checks';
import { designAtComplete } from '../design';
import { createExclusive, exists, fingerprint, readOptional, writeAtomic, writeJson } from '../files';
import { crossed, longFilesIn, longFileText } from '../longFiles';
import { checkVersions } from '../materialise';
import { mergeLines } from '../merge3';
import { unreadForHolder } from '../messages';
import { entryOf } from '../model';
import { lockFile, NOT_TASK_DIRS, taskPaths, under } from '../paths';
import { RunRefusal } from '../refusal';
import { assertStatus, loadRun, logRun, readApproved, readBase, recordBrake } from '../run';
import { keepFiles, putBlob, withLock } from '../store';
import { tellLeftInTmp } from '../strays';
import {
  appendLog,
  lockedFiles,
  readRequests,
  readStart,
  requestId,
  updateState,
  viewTask,
  writeRequest
} from '../taskStore';
import { digestsOf, escapeRegExp } from './approve';
import { at, changedInCopy, cleanPath, findTask, holderOf, refreshCopy } from './common';
import { textOf } from './context';
import { activeHolder, allLocks, sharedFiles } from './locks';

import type { CheckResult } from '../checks';
import type { Message } from '../messages';
import type { AcceptanceResult, FileLock, SharedRequest } from '../model';
import type { LoadedRun, RunContext } from '../run';
import type { TaskView } from '../taskStore';

/**
 * `plitzi task complete`: the copy compared by fingerprint, the checks and the acceptance run in it, and the task in
 * review — or refused, saying what to fix. `task discard` puts a file of the copy back.
 */

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
  /** Approved in the run, or changed in the project by a person, since the copy was made: brought in before the checks. */
  brought: string[];
  /** Shared files nobody else held, taken by turns as it completed: they go into the run with it. */
  claimed: string[];
  /** Files the run changed since the copy was made, put together with the task's change line by line. */
  merged: string[];
  /** What the lead said to it and it had not read. */
  messages: Message[];
  requests: SharedRequest[];
  checks: CheckResult;
  /** Its acceptance's checks, as they answered — none when it has none, or the project's checks failed first. */
  accepted: AcceptanceResult[];
  /** The task's files a person (or something else) changed in the project meanwhile: the person wins at the merge. */
  changedInProject: string[];
}

/**
 * `plitzi task complete`: the copy compared with where it started, by fingerprint — what it changed outside its files
 * is refused, naming each; what it changed in a shared file it does not hold becomes a request — then the project's
 * checks run in the copy, and it goes to review.
 */
/** What a check that passed still warned of, each as `<check>: <warning>`. */
const warningsOf = (checks: CheckResult): string[] =>
  checks.steps.flatMap(step => (step.warnings ?? []).map(warning => `${step.name}: ${warning}`));

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
  await tellLeftInTmp(ctx, loaded);
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

  // Gone, every file of it would read as removed — and be refused as another task's: said as what it is.
  if (!(await exists(view.paths.work))) {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}"'s copy is gone (${view.paths.work}): what was written in it is lost. Take the task again (plitzi task take ${taskId}) — it starts from its last reviewed version, or from the run's work`,
      { task: taskId, work: view.paths.work, next: `plitzi task take ${taskId}` }
    );
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
  // A link in the copy is read through: what it points at — the project's .env, a key — would go to review as the file.
  const links: string[] = [];
  for (const file of changed) {
    if ((await fs.lstat(under(view.paths.work, file)).catch(() => undefined))?.isSymbolicLink()) {
      links.push(file);
    }
  }

  if (links.length > 0) {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}" turned ${links.join(', ')} into ${links.length === 1 ? 'a link' : 'links'}: a task writes files, never a link — what it points at would go to review as the file. Write the file itself in your copy, and complete again`,
      { task: taskId, files: links }
    );
  }

  // The CLI's part of the project: its copy holds it to author and check, and no task writes it.
  const cliFiles = changed.filter(file => NOT_TASK_DIRS.has(file.split('/')[0]));
  if (cliFiles.length > 0) {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}" changed ${cliFiles.join(', ')}: that is the CLI's part of the project, which plitzi upgrade keeps — put it back (plitzi task discard <file>) and complete again`,
      { task: taskId, files: cliFiles }
    );
  }

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
  // Under the claim lock: whether another holds it and taking it are one step — two tasks completing at once never
  // both take a shared file.
  const claimedNow = await withLock(
    loaded.paths.claimLock,
    async () => {
      const locks = await allLocks(ctx);
      const taken: string[] = [];
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
          taken.push(file);
          asRequests.splice(asRequests.indexOf(file), 1);
        }
      }

      return taken;
    },
    { now: ctx.now }
  );

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

  // A file it took past what is read whole is split before review: the lead never receives a 500-line file to approve.
  const tooLong = (await longFilesIn(view.paths.work, ctx.root)).filter(crossed);
  if (tooLong.length > 0 && !knownFailure) {
    await recordBrake(ctx, loaded, 'checks-failed');
    throw new RunRefusal(
      'checks-failed',
      `Task "${taskId}" leaves files too long to read whole: ${tooLong.map(longFileText).join('; ')}`,
      {
        task: taskId,
        steps: tooLong.map(long => ({ name: `file length — ${long.file}`, ok: false, said: [longFileText(long)] })),
        next: 'split each by what changes together — a section or a part per file, a block as a component or a function, its rows as data — and complete again'
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

  const toReview = changed.filter(file => !asRequests.includes(file));
  const designed = await designAtComplete(loaded, view, toReview);
  // What goes to review is kept now: the copy is the agent's to go on writing, and the lead approves what it looked at.
  const submitted = await keepFiles(loaded.paths, view.paths.work, toReview);
  await updateState(
    view.paths,
    state => ({
      ...state,
      status: 'in-review',
      changed: toReview,
      submitted,
      // A designer looks at its UI before the lead, each round its UI changed: what it changed is what is looked at.
      design: designed.design,
      ...(accepted.length > 0 ? { accepted } : { accepted: undefined }),
      warnings: warningsOf(checks).length > 0 ? warningsOf(checks) : undefined,
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
        ...(designed.carried ? [{ at: at(ctx), by: 'plitzi', text: designed.carried }] : []),
        ...(changedInProject.length > 0
          ? [
              {
                at: at(ctx),
                by: 'plitzi',
                text: `Changed in the project meanwhile: ${changedInProject.join(', ')} — your work is kept: the lead decides at review, putting the two together line by line when they go together. To build on the project's version instead: plitzi task discard <file>, and redo your change on it`
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
    accepted,
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
