import fs from 'node:fs/promises';
import path from 'node:path';

import { checkedStill, checkKey } from './checked';
import { at, changedInCopy, cleanPath, findTask, holderOf, refreshCopy } from './common';
import { textOf } from './context';
import { keepAlive } from './keepAlive';
import { activeHolder, allLocks, sharedFiles, untakenNow } from './locks';
import { againstRunWork, tellUnanswered } from './notOwn';
import { othersHeld } from './othersHeld';
import { reviewAtComplete, reviewSteps, reviewTeamOf, stepsLeftOut } from './reviews';
import { isNotice } from '../../commands/project/verify';
import { unifiedDiff } from '../../fix/diff';
import { checkAcceptance, letGo, serveForAcceptance } from '../copies/acceptance';
import { failsWithout, ownFailing } from '../copies/checks';
import { mergeLines } from '../copies/merge3';
import { backupFiles, backupText, tellLeftInTmp } from '../copies/strays';
import { createExclusive, exists, fingerprint, readOptional, writeAtomic, writeJson } from '../core/files';
import { entryOf } from '../core/model';
import { lockFile, NOT_TASK_DIRS, taskPaths, under } from '../core/paths';
import { RunRefusal } from '../core/refusal';
import { keepFiles, putBlob, withLock } from '../core/store';
import {
  appendLog,
  lockedFiles,
  readRequests,
  readStart,
  requestId,
  updateState,
  viewTask,
  writeRequest
} from '../core/taskStore';
import { crossed, longFilesIn, longFileText } from '../plan/longFiles';
import { logSpent } from '../report/spent';
import { keepTaskReport } from '../report/taskReports';
import { assertStatus, loadRun, logRun, readApproved, readBase, recordBrake } from '../run';
import { proposalsOf, unansweredTo } from '../talk/agreements';
import { handOver } from '../talk/handOver';
import { LEAD, unreadForHolder } from '../talk/messages';

import type { CheckResult } from '../copies/checks';
import type { AcceptanceResult, FileLock, SharedRequest, TaskStart } from '../core/model';
import type { TaskView } from '../core/taskStore';
import type { Experience } from '../report/experience';
import type { LoadedRun, RunContext } from '../run';
import type { Message } from '../talk/messages';

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
    await recordBrake(ctx, loaded, 'conflict', view.task.id);
    // Who changed those lines in the run: what the agent weighs before it redoes anything over approved work.
    const by = conflicts.map(each => {
      const entry = entryOf(approved.files, each.file);

      return `${each.file}${entry ? ` (by "${entry.task}", approved)` : ''}`;
    });
    throw new RunRefusal(
      'conflict',
      `The run changed ${by.join(', ')} since task "${view.task.id}"'s copy was made, on the same lines this task changed. If your change still fits beside it, take the run's version (plitzi task discard <file>), redo your change on it — what this task changed is in this answer — and complete again. If your acceptance contradicts what was approved, do not undo it: ask the lead (plitzi task tell "…" --ask)`,
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
  /** Its checks fail the same way in the run's work without it: not its own, nor said by a known failure. */
  preexisting?: true;
  /** Its acceptance's checks, as they answered — none when it has none, or the project's checks failed first. */
  accepted: AcceptanceResult[];
  /** The task's files a person (or something else) changed in the project meanwhile: the person wins at the merge. */
  changedInProject: string[];
  /** When `task check` passed them, the checks taken from it: nothing changed since, so not run again. */
  checkedAt?: string;
  /** The round's report, kept for the run's (`taskReports.ts`): which round, and whether it says what it was like. */
  report: { round: number; experience?: true };
}

/** What a check that passed still warned of, each as `<check>: <warning>`. */
/**
 * The checks' warnings a review reads: those on a file the task changed, each — and the rest counted in a line, theirs
 * whose file it is. An integrate task's review listed an unused-file warning on a file it never touched.
 */
const warningsOf = (checks: CheckResult, changed: readonly string[]): string[] => {
  const all = checks.steps.flatMap(step => (step.warnings ?? []).map(warning => ({ step: step.name, warning })));
  const ours = ({ warning }: { warning: string }) =>
    changed.some(file => warning.startsWith(`${file}:`) || warning.startsWith(`${file} `));
  const others = all.filter(each => !ours(each)).length;

  return [
    ...all.filter(ours).map(({ step, warning }) => `${step}: ${warning}`),
    ...(others > 0
      ? [
          `${String(others)} more in files it did not change — another task's, or the project's: npx plitzi space lint lists them`
        ]
      : [])
  ];
};

export interface CompleteOptions {
  /** Go to review although the checks fail — for a reason that weighs, with the task that fixes it. */
  knownFailure?: { why: string; fixedBy?: string };
  /** What it was like to work with Plitzi this round, in the agent's words (`experience.ts`): kept in its report. */
  experience?: Experience;
}

/**
 * `plitzi task complete`: the copy compared with where it started, by fingerprint — what it changed outside its files
 * is refused, naming each; what it changed in a shared file it does not hold becomes a request — then the project's
 * checks run in the copy, and it goes to review.
 */
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
  // A task waiting for a file completes too, leaving its queue: what it waited for it does without — and a change to that
  // file still in its copy is refused below, naming it (dev-1's wait for a file ran out, t-heading stayed
  // waiting, and nothing let it complete).
  if (!['in-progress', 'changes-requested', 'waiting'].includes(view.state.status)) {
    throw new RunRefusal('invalid', `Task "${taskId}" is ${view.state.status}: only a task in progress completes`, {
      task: taskId
    });
  }

  if (!(await readStart(view.paths))) {
    throw new RunRefusal('invalid', `Task "${taskId}" has no copy: take it again (plitzi task next ${taskId})`);
  }

  // Gone, every file of it would read as removed — and be refused as another task's: said as what it is.
  if (!(await exists(view.paths.work))) {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}"'s copy is gone (${view.paths.work}): what was written in it is lost. Take the task again (plitzi task next ${taskId}) — it starts from its last reviewed version, or from the run's work`,
      { task: taskId, work: view.paths.work, next: `plitzi task next ${taskId}` }
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

  // What the lead said to it, unread, comes before a review: a run's dev-1 completed 30 s after a send-back, the lead's
  // word on its scope unread, and the round answered none of it. Handed over here, read: the next complete goes on.
  const fromLead = (await unreadForHolder(loaded, taskId, ctx.agent, false)).filter(message => message.from === LEAD);
  if (fromLead.length > 0) {
    await unreadForHolder(loaded, taskId, ctx.agent, true);
    throw new RunRefusal(
      'invalid',
      `The lead told ${taskId} what was not read yet — do what it asks, then complete again: ${fromLead.map(message => `${message.id}: ${message.text}`).join(' · ')}`,
      { task: taskId, messages: fromLead.map(message => message.id), next: `plitzi task complete ${taskId}` }
    );
  }

  // Checked against the run as it is now: what was approved since the copy was made, and the task left alone, comes in.
  const brought = await refreshCopy(ctx, loaded, view);
  const started = await readStart(view.paths);
  if (!started) {
    throw new RunRefusal('invalid', `Task "${taskId}" has no copy: take it again (plitzi task next ${taskId})`);
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

  const { outside, asRequests } = await whoseChanges(loaded, view, changed, started);

  if (outside.length > 0) {
    await recordBrake(ctx, loaded, 'refused', taskId);
    // A file of a task nobody took yet is taken ahead of it by a claim: said, as a refusal names its way out.
    const ahead: string[] = [];
    for (const each of outside) {
      if (await untakenNow(loaded, findTask(loaded, each.holder))) {
        ahead.push(each.file);
      }
    }

    throw new RunRefusal(
      'claimed',
      `Task "${taskId}" changed files another task at work holds: ${outside
        .map(each => `${each.file} (task "${each.holder}"'s)`)
        .join(', ')}.${
        ahead.length > 0
          ? ` Nobody has taken the task of ${ahead.join(', ')} yet: plitzi task claim ${ahead.join(' ')} takes ${ahead.length === 1 ? 'it' : 'them'} ahead of it, your change kept — then complete again.`
          : ''
      } Put each back in your copy (plitzi task discard <file>) and propose the change to its task (plitzi task propose <task> --change …), or wait for it (plitzi task claim <file> --wait) — or, if your work needs it there and its task said no, tell the lead (plitzi task tell "…"): it decides.`,
      {
        task: taskId,
        files: outside.map(each => each.file),
        next: 'put each back (plitzi task discard <file>) and propose the change to its task, or wait for the file (plitzi task claim <file> --wait) and complete again'
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
  const held = await lockedFiles(view.paths);
  const mergedNow = await mergeMoved(ctx, loaded, view, [
    ...changed.filter(file => held.has(file) || task.files.includes(file)),
    ...claimedNow
  ]);
  const start = (await readStart(view.paths)) ?? started;

  const { knownFailure } = options;
  // `lead`: what fails is the lead's to settle — a line of its that cannot pass — not any task's (agents named
  // a task at work as a placeholder, which told the wrong task it had something to fix).
  const fixer =
    knownFailure?.fixedBy === undefined || knownFailure.fixedBy === LEAD
      ? undefined
      : findTask(loaded, knownFailure.fixedBy);
  if (fixer && (fixer.id === taskId || (await viewTask(loaded.paths, fixer)).state.status === 'done')) {
    throw new RunRefusal(
      'invalid',
      `--fixed-by names the task that fixes what fails later, or lead when it is the lead's to settle (a line of its): "${fixer.id}" is ${fixer.id === taskId ? 'this task' : 'done'}`,
      { task: taskId }
    );
  }

  // What `task check` passed, on these very files and this run, stands: not run again (`checked.ts`).
  const kept = await checkedStill(view.paths, await checkKey(loaded, view.paths, task, changed), ctx.now());
  // The copy served for the acceptance while the project's checks run; let go whatever ends them (a refusal too).
  const where = { work: view.paths.work, root: ctx.root, cache: view.paths.cache };
  const serving = kept ? undefined : serveForAcceptance(task.acceptance, where);
  // Its sign of life given while the checks run: the agent inside `complete` can give none.
  const { checks, failing, preexisting, accepted, others } = await keepAlive(view, ctx.now, async () => {
    const checks = kept?.checks ?? (await ctx.checks(view.paths.work, ctx.root));
    const failing = checks.steps.filter(step => !step.ok);
    // What fails in the copy may not be the task's: a person's edit in the project, or another task's approved work, that
    // fails the checks reaches every copy. Checked against the run's work without this task before it is refused.
    const { without, dirs } = await againstRunWork(ctx, loaded, view, checks);
    const preexisting = !knownFailure && without !== undefined ? failsWithout(checks, without, dirs) : false;
    // A known failure covers what it names: a step only this copy fails, its reason silent on it, is the task's own
    // (t-contact's said the shell's empty layout, and its own duplicate token's typecheck went to review).
    const unsaid =
      knownFailure && without !== undefined
        ? ownFailing(checks, without, dirs).filter(step => !knownFailure.why.toLowerCase().includes(step.name))
        : [];
    if (unsaid.length > 0) {
      throw new RunRefusal(
        'checks-failed',
        `${unsaid.map(step => step.name).join(', ')} ${unsaid.length === 1 ? 'fails' : 'fail'} in this copy and not in the run's work — this task's own, which the known failure does not say: fix ${unsaid.length === 1 ? 'it' : 'them'}, or name ${unsaid.length === 1 ? 'it' : 'them'} in plitzi task complete --known-failure "why"`,
        { task: taskId, steps: unsaid }
      );
    }
    if (!checks.ok) {
      // The brake counts the copy's own failures: one the run's work fails the same way — a half-merged approval, a
      // person's edit — is no agent's, said or not (the brake fired on the run's own breakage and stopped the
      // stage that would have finished it).
      if (without === undefined || !failsWithout(checks, without, dirs)) {
        await recordBrake(ctx, loaded, 'checks-failed', taskId);
      }

      if (!knownFailure && !preexisting) {
        // What the copy took from the run on this complete is said first: a run's test-1 checked green, completed,
        // and failed on a file the run had approved since — no word of which had come in.
        throw new RunRefusal(
          'checks-failed',
          `The project's checks fail in task "${taskId}"'s copy${brought.length > 0 ? ` — and it took from the run, on this complete, what was approved since: ${brought.join(', ')}; what fails may come from them — the run's version of each: plitzi run show <run> <file>` : ''}`,
          {
            task: taskId,
            ...(brought.length > 0 ? { brought } : {}),
            steps: failing,
            next: 'fix what fails and complete again — or, for a reason that weighs, task complete --known-failure "why" [--fixed-by <task>|lead]'
          }
        );
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
    // …or when what fails is the run's work's too (preexisting): no one's, it stops nothing of this task's.
    const accepted = kept
      ? kept.accepted
      : checks.ok || (without !== undefined && failsWithout(checks, without, dirs))
        ? await checkAcceptance(task.acceptance, { ...where, ...(serving ? { serving } : {}) })
        : [];
    // Its own lines met: the approved tasks' lines on the pages it draws, on the same copy (`othersHeld`).
    const others =
      !kept && accepted.every(result => result.ok)
        ? await othersHeld(loaded, taskId, changed, { ...where, ...(serving ? { serving } : {}) })
        : [];

    return { checks, failing, preexisting, accepted, others };
  }).finally(() => letGo(serving));
  const unmet = accepted.filter(result => !result.ok);
  // A line nothing could answer is the lead's, told: the brake is for the work, and the agent is told it is not its.
  const unread = await tellUnanswered(ctx, loaded, taskId, unmet);
  if (unmet.length > 0 && !knownFailure) {
    if (unread.length < unmet.length) {
      await recordBrake(ctx, loaded, 'checks-failed', taskId);
    }

    throw new RunRefusal(
      'checks-failed',
      `Task "${taskId}"'s acceptance is not met: ${unmet.map(each => `"${each.said}"${each.unanswered ? ' (nothing could answer it: the lead is told — not your work)' : ''}`).join(', ')}`,
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

  // An approved task's line nothing could answer on the copy is that line's to amend, as one of its own: the lead is told.
  for (const line of others.filter(each => each.unanswered === true)) {
    await tellUnanswered(ctx, loaded, line.task, [line]);
  }

  const broke = others.filter(line => !line.ok && line.unanswered !== true);
  if (broke.length > 0 && !knownFailure) {
    throw new RunRefusal(
      'checks-failed',
      `Task "${taskId}" breaks what approved tasks were accepted on: ${broke.map(line => `${line.task}: "${line.said}"`).join('; ')}`,
      {
        task: taskId,
        steps: broke.map(line => ({
          name: `${line.task}'s acceptance — ${line.said}`,
          ok: false,
          said: [line.check, ...(line.output ?? [])]
        })),
        next: 'make it hold again — or, when your change means it (a page moved, its words rewritten), task complete --known-failure "why" --fixed-by lead: the lead amends that line'
      }
    );
  }

  // A backup an editor left is no work of the task's: never handed to review as an added file (a run's `-E`).
  const backups = backupFiles(changed);
  if (backups.length > 0) {
    throw new RunRefusal('checks-failed', `Task "${taskId}" holds backups an editor left: ${backups.join(', ')}`, {
      task: taskId,
      steps: backups.map(file => ({ name: `backup — ${file}`, ok: false, said: [backupText(file)] })),
      next: backups.map(file => `plitzi task discard ${file}`).join('; ')
    });
  }

  // A file it took past what is read whole is split before review: the lead never receives a 500-line file to approve.
  const tooLong = (await longFilesIn(view.paths.work, ctx.root)).filter(crossed);
  if (tooLong.length > 0 && !knownFailure) {
    await recordBrake(ctx, loaded, 'checks-failed', taskId);
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

  // A file it hands over has no warning of the space's lint, whoever wrote it: a run's run left ten in files its tasks
  // changed — each said at complete, none fixed — and the finish passed with them.
  const warned = (checks.steps.find(step => step.name === 'lint:space')?.warnings ?? []).filter(warning =>
    changed.some(file => warning.startsWith(`${file}:`) || warning.startsWith(`${file} `))
  );
  if (warned.length > 0 && !knownFailure) {
    await recordBrake(ctx, loaded, 'checks-failed', taskId);
    throw new RunRefusal(
      'checks-failed',
      `Task "${taskId}" leaves warnings of the space's lint in files it changed: ${warned.join('; ')}`,
      {
        task: taskId,
        steps: [{ name: 'lint:space — the files it changed', ok: false, said: warned }],
        next: 'fix each as npx plitzi space lint says — there before the task or not, a file it hands over has none; one written so on purpose says it with quiet — and complete again'
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
  // Its review's roles nobody in the team takes are left out, and said: the next step's reviewer looks for them.
  const reviewTeam = await reviewTeamOf(ctx.root);
  const leftOut = stepsLeftOut(task, reviewTeam);
  // What goes to review is kept now: the copy is the agent's to go on writing, and the lead approves what it looked at.
  const submitted = await keepFiles(loaded.paths, view.paths.work, toReview);
  await updateState(
    view.paths,
    state => ({
      ...state,
      status: 'in-review',
      waitingFor: undefined,
      changed: toReview,
      submitted,
      // Its first step due: each round goes through the card's review again, the one who said a step offered it first.
      review: reviewAtComplete(state, at(ctx)),
      ...(accepted.length > 0 ? { accepted } : { accepted: undefined }),
      warnings: warningsOf(checks, changed).length > 0 ? warningsOf(checks, changed) : undefined,
      knownFailure: preexisting
        ? {
            why: `the run's work fails ${failing.map(step => step.name).join(', ')} the same way without this task: ${failing.flatMap(step => step.said ?? []).find(line => line.trim() !== '' && !isNotice(line)) ?? 'see the checks'}`,
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
        ...(leftOut.length > 0 && state.round === 0
          ? [
              {
                at: at(ctx),
                by: 'plitzi',
                text: `Its review names ${leftOut.join(', ')}, and nobody in the team takes ${leftOut.length === 1 ? 'that role' : 'those roles'}: its review goes ${reviewSteps(task, reviewTeam).join(' → ')}`
              }
            ]
          : []),
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
  await recordBrake(ctx, loaded, 'completed', taskId);
  await appendLog(view.paths.log, { at: at(ctx), by: ctx.agent, action: 'complete', changed, requests: asRequests });
  await logRun(ctx, loaded.paths, {
    action: 'complete',
    task: taskId,
    changed: changed.length,
    requests: asRequests,
    // The steps of its review, in order: who looks at it, and after whom.
    review: reviewSteps(task, reviewTeam)
  });
  // The round as it was worked, kept beside the task: the run's report is put together from these.
  const report = await keepTaskReport(loaded, view.paths, {
    task: taskId,
    // The round its review will say (`review.ts`): the first sent is round 1.
    round: view.state.round + 1,
    agent: ctx.agent,
    to: at(ctx),
    ...(options.experience === undefined ? {} : { experience: options.experience })
  });
  await logSpent(ctx, loaded, taskId, 'task');

  return {
    changed,
    brought,
    claimed: claimedNow,
    merged: mergedNow,
    requests,
    checks,
    ...(preexisting ? { preexisting: true as const } : {}),
    accepted,
    changedInProject,
    ...(kept ? { checkedAt: kept.at } : {}),
    report: { round: report.round, ...(report.experience ? { experience: true as const } : {}) },
    messages: await handOver(ctx, loaded, taskId, ctx.agent)
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

/**
 * What the task changed that is not its own: a file another task at work holds (`outside`, which `complete` refuses),
 * and a shared one or one in no task it takes by turns or requests (`asRequests`). `task check` says the first before
 * the work is done: a run's t-boxer learnt it changed t-lint's `theme.ts` only at `complete`.
 */
export const whoseChanges = async (
  loaded: LoadedRun,
  view: TaskView,
  changed: readonly string[],
  started: TaskStart
): Promise<{ outside: { file: string; holder: string }[]; asRequests: string[] }> => {
  const { task } = view;
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
    const planned = await activeHolder(loaded, file, task);
    if (planned && planned.id !== task.id) {
      outside.push({ file, holder: planned.id });
    } else if (shared.has(file) || Object.hasOwn(started.files, file)) {
      asRequests.push(file);
    }
  }

  return { outside, asRequests };
};
