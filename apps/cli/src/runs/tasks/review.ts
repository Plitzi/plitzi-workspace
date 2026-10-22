import fs from 'node:fs/promises';
import path from 'node:path';

import { readyWhatWaited, sayIfAllDone, statesOf } from './handOn';
import { proposalsOf } from '../agreements';
import { approveDesign, assertDesigner, designDue } from '../design';
import { exists, fingerprint, writeJson } from '../files';
import { assertReviewingLead, isCoLead, isPrincipal } from '../leads';
import { agentAddress, LEAD, messagesOf, sendMessage, unreadFor } from '../messages';
import { taskPaths, under } from '../paths';
import { syncPreview } from '../preview';
import { RunRefusal } from '../refusal';
import { assertStatus, loadRun, logRun, readApproved, recordBrake, requireNoTask } from '../run';
import { keepFiles, withLock } from '../store';
import { DEFAULTS, lockedFiles, readRequests, readStart, revokeOwner, updateState, viewTask } from '../taskStore';
import { DESIGNER, readTeam, startedAgents, TEAM_FILE } from '../team';
import { buildMergeIntoRun, buildRequestsMerge, changeApproved } from './approve';
import { at, changedInCopy, findTask, refreshCopy } from './common';
import { grantWaiters } from './locks';
import { integrateWhenReady, settleRequests } from './requests';

import type { DesignSkip } from '../designSkip';
import type { ProjectChange, ReviewComment, TaskStart, TaskState } from '../model';
import type { LoadedRun, RunContext } from '../run';
import type { TaskView } from '../taskStore';

/**
 * `plitzi task review`: the lead's verdict — or a designer's on a task's UI — on a task in review.
 */

export interface ReviewedTask {
  verdict: 'approve' | 'changes';
  round: number;
  /** Approved: what it brought into the run's work, what it let go of to whom, and the tasks it made ready. */
  merged?: string[];
  granted?: string[];
  ready?: string[];
  integrations?: string[];
  /** Approved, and the run's preview could not take it in: why — the approval stands. */
  previewProblem?: string;
  /** Requests of done tasks on the files it let go of, merged now — and integration tasks left with nothing to do. */
  settled?: string[];
  /** Approved: the shared files its requests went into — another task's held or not — and those that did not, and why. */
  fulfilled?: string[];
  unmerged?: { files: string[]; reason: string };
  /** Past the round limit: blocked for the lead to decide — the one that speaks to the person. */
  toLead?: boolean;
  /** Its files a person changed meanwhile, put together with its change (--merge). */
  joined?: string[];
  /** A designer approved its UI — it is the lead's now — or the lead approved it without that review. */
  design?: 'approved' | 'skipped';
  /** `skipped`: why, as the lead said it. */
  designSkip?: DesignSkip;
  /** Written in its copy after it went to review: not part of what was reviewed, so not merged. */
  notReviewed?: string[];
  /**
   * Sent back while its agent is at another task: the tasks that wait on this one — that agent was told it goes first,
   * since nothing else reaches it before it finishes the one in hand.
   */
  goesFirst?: string[];
}

/**
 * A task sent back that others wait on, while its agent is at another: the agent hears it with its next heartbeat —
 * otherwise it would finish the task in hand first, and every task behind this one would wait that long more.
 */
const tellItGoesFirst = async (ctx: RunContext, loaded: LoadedRun, view: TaskView): Promise<string[]> => {
  const agent = view.owner?.agent;
  if (agent === undefined) {
    return [];
  }

  const views = await Promise.all(loaded.tasks.map(each => viewTask(loaded.paths, each)));
  const inHand = views.filter(
    each => each.task.id !== view.task.id && each.owner?.agent === agent && each.state.status === 'in-progress'
  );
  const waiting = views
    .filter(
      each =>
        each.state.status !== 'done' &&
        (each.task.dependsOn.includes(view.task.id) || each.state.waitingFor?.task === view.task.id)
    )
    .map(each => each.task.id);
  if (inHand.length === 0 || waiting.length === 0) {
    return [];
  }

  await sendMessage(ctx, loaded, {
    from: LEAD,
    to: agentAddress(agent),
    text: `${view.task.id} came back with changes (round ${String(view.state.round + 1)}), and ${waiting.join(', ')} ${waiting.length === 1 ? 'waits' : 'wait'} on it: it goes before ${inHand.map(each => each.task.id).join(', ')}. Bring what you are at to a point you can leave (plitzi task progress), then go back to it: plitzi task context ${view.task.id}`
  });

  return waiting;
};

/** A UI review is a designer's of the team, by the name it was started with — another agent's verdict is not one. */
const assertTeamDesigner = async (ctx: RunContext, taskId: string): Promise<void> => {
  const team = await readTeam(ctx.root);
  if (!team) {
    return;
  }

  const designers = startedAgents(team).filter(each => each.roles.includes(DESIGNER));
  if (!designers.some(each => each.agent === ctx.agent)) {
    throw new RunRefusal(
      'invalid',
      `${ctx.agent} is no designer of the team (${TEAM_FILE}): ${
        designers.length > 0 ? designers.map(each => each.agent).join(', ') : 'none of its agents'
      } or the lead review ${taskId}'s UI — the lead, as itself: plitzi task review ${taskId} --approve --token <the lead's>`,
      { task: taskId, designers: designers.map(each => each.agent) }
    );
  }
};

/** What `taskId`'s copy holds that did not go to review — what `task look` would serve the lead without it being so. */
export const notReviewedIn = async (ctx: RunContext, runId: string, taskId: string): Promise<string[]> => {
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  const view = await viewTask(loaded.paths, findTask(loaded, taskId));
  const start = await readStart(view.paths);

  return start && view.state.submitted ? writtenSince(view, start, view.state.submitted) : [];
};

/** The files its copy holds otherwise than it went to review — changed again, or changed for the first time since. */
const writtenSince = async (
  view: TaskView,
  start: TaskStart,
  submitted: Readonly<Record<string, string | null>>
): Promise<string[]> => {
  if (!(await exists(view.paths.work))) {
    return [];
  }

  // A file it asked another to change went with it as the request's version: it counts as submitted at that one.
  const asked = Object.fromEntries((await readRequests(view.paths)).map(request => [request.file, request.wanted]));
  const sent = { ...asked, ...submitted };
  const late = new Set((await changedInCopy(view, start)).filter(file => !Object.hasOwn(sent, file)));
  for (const [file, digest] of Object.entries(sent)) {
    if ((await fingerprint(under(view.paths.work, file))) !== digest) {
      late.add(file);
    }
  }

  return [...late].sort();
};

/**
 * Whether asking for changes now blocks the task for the lead: its rounds of this kind — the designer's on its UI, the
 * lead's on the rest — at their limit with this one. Said to the reviewer before it asks (`task next`), never found out
 * after (velada-dress: design-2's third round on t-overlay).
 */
export const changesBlock = (state: Pick<TaskState, 'round' | 'designRounds'>, byDesigner: boolean): boolean => {
  const designRounds = state.designRounds ?? 0;

  return (byDesigner ? designRounds + 1 : state.round + 1 - designRounds) >= DEFAULTS.reviewRounds;
};

/**
 * `plitzi task review`: the lead's or a reviewer's verdict on a task in review. Changes go back to the same task
 * with comments, and past the round limit blocked for the lead to decide; approval keeps its reviewed version, merges it into the run's
 * work, lets its files go to whoever waits for them, and makes ready what was waiting on it.
 */
export const reviewTask = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  verdict: 'approve' | 'changes',
  comments: ReviewComment[],
  onProjectChange: ProjectChange = 'refuse',
  options: { skipDesign?: DesignSkip } = {}
): Promise<ReviewedTask> => {
  requireNoTask(ctx, 'review a task');
  const loaded = await loadRun(ctx, runId);
  // One verdict at a time on a task: two leads saying one at once, the second reads the first's — never both merged.
  return withLock(
    taskPaths(loaded.paths, findTask(loaded, taskId).id).reviewLock,
    () => decide(ctx, runId, taskId, verdict, comments, onProjectChange, options),
    { now: ctx.now, ttlMs: 15 * 60_000, waitMs: 5 * 60_000 }
  );
};

const decide = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  verdict: 'approve' | 'changes',
  comments: ReviewComment[],
  onProjectChange: ProjectChange,
  { skipDesign }: { skipDesign?: DesignSkip }
): Promise<ReviewedTask> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'review a task');
  const task = findTask(loaded, taskId);
  const view = await viewTask(loaded.paths, task);
  // Past the round limit it is the lead's to decide — the lead speaks to the person, if it must ask — never an agent's:
  // velada-now's t-boxer waited for "a person" nobody in the run was.
  const atLimit = view.state.status === 'blocked' && view.state.blockedBy?.review === true;
  if (atLimit && verdict === 'approve') {
    if (!isPrincipal(ctx.agent)) {
      throw new RunRefusal(
        'lead-only',
        `Task "${taskId}" is past its review rounds: the lead decides — approves it as it is, or answers it (plitzi task unblock ${taskId} --answer "…")`,
        { task: taskId, holder: LEAD }
      );
    }
  } else if (view.state.status !== 'in-review') {
    throw new RunRefusal(
      'invalid',
      atLimit
        ? `Task "${taskId}" is past its review rounds: the lead approves it as it is, or answers it (plitzi task unblock ${taskId} --answer "…")`
        : `Task "${taskId}" is ${view.state.status}, not in review`,
      { task: taskId }
    );
  }

  // What the lead said to a reviewer while it reviewed is read before its verdict, not after: design-1's round on
  // t-match-bars went out before the lead's "only the bars this round" reached it (velada-polish). Handed over here,
  // read; said again, the verdict goes.
  if (!isPrincipal(ctx.agent)) {
    const meanwhile = (await unreadFor(loaded, agentAddress(ctx.agent), true)).filter(message => message.from === LEAD);
    if (meanwhile.length > 0) {
      throw new RunRefusal(
        'invalid',
        `The lead said this to you while you reviewed — read it before your verdict on ${taskId}, then say it again with it in mind:\n${meanwhile.map(message => `  ${message.id}: ${message.text}`).join('\n')}`,
        { task: taskId, messages: meanwhile.map(message => message.id) }
      );
    }
  }

  // Its UI waits for a designer: an agent's verdict is the designer's; the lead's approval waits for it, or says it skips.
  const asLead = isPrincipal(ctx.agent) || isCoLead(loaded.record, ctx.agent);
  const byDesigner = designDue(view.state) && !asLead;
  if (byDesigner) {
    if (skipDesign) {
      throw new RunRefusal(
        'invalid',
        `--skip-design is a lead's: ${ctx.agent} is not one. A lead approves without the UI review as itself — plitzi task review ${taskId} --approve --skip-design lead --token <the lead's>`,
        { task: taskId }
      );
    }

    await assertTeamDesigner(ctx, taskId);
    assertDesigner(view, ctx.agent);
    if (verdict === 'approve') {
      await approveDesign(ctx, loaded, view, comments.map(comment => comment.note).join(' · ') || undefined);

      return { verdict, round: view.state.round, design: 'approved' };
    }
  } else {
    await assertReviewingLead(ctx, loaded, view);
  }

  if (!byDesigner && verdict === 'approve' && designDue(view.state) && !skipDesign) {
    const by = view.state.design?.by;
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}"'s UI waits for ${by ?? 'a designer'}'s review${by ? '' : ' (none took it yet)'}: run watch --until lead wakes you once it is said — or approve it now without it, saying why: --skip-design lead (you looked at its UI yourself, as a designer would) or --skip-design no-ui (it changes nothing a visitor sees)`,
      { task: taskId, ...(by ? { designer: by } : {}) }
    );
  }

  const skipped = verdict === 'approve' && designDue(view.state);
  const why = skipped ? skipDesign : undefined;

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
  // What went to review is what is reviewed: written in the copy after `complete`, a change is not part of this round.
  const submitted = view.state.submitted ?? (await keepFiles(loaded.paths, view.paths.work, changed));
  const notReviewed = await writtenSince(view, start, submitted);
  await writeJson(view.paths.reviewed, { round, at: at(ctx), files: submitted });
  await writeJson(view.paths.review, { round, verdict, comments, by: ctx.agent, at: at(ctx) });

  if (verdict === 'changes') {
    // Counted apart: the designer's rounds on its UI, and the lead's on the rest — each kind to its own limit.
    const designRounds = (view.state.designRounds ?? 0) + (byDesigner ? 1 : 0);
    const ofKind = byDesigner ? designRounds : round - designRounds;
    const toLead = changesBlock(view.state, byDesigner);
    // It redoes its work on the run as it is now: what was approved while it was in review comes into its copy.
    const brought = toLead ? [] : await refreshCopy(ctx, loaded, view);
    await updateState(
      view.paths,
      state => ({
        ...state,
        round,
        ...(designRounds > 0 ? { designRounds } : {}),
        status: toLead ? 'blocked' : 'changes-requested',
        ...(toLead
          ? {
              blockedBy: {
                reason: `${String(ofKind)} rounds of ${byDesigner ? 'its UI review' : 'the lead’s'} changes: the lead decides — approves it as it is (plitzi task review ${taskId} --approve), settles what is left with an answer (plitzi task unblock ${taskId} --answer "…"), or asks the person`,
                needs: 'lead' as const,
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
    // The designer's changes are its UI review's, as its approvals are: read apart from the lead's in the activity.
    await logRun(
      ctx,
      loaded.paths,
      byDesigner
        ? { action: 'design-review', task: taskId, verdict, round }
        : { action: 'review', task: taskId, verdict, round }
    );
    const goesFirst = toLead ? [] : await tellItGoesFirst(ctx, loaded, view);

    return {
      verdict,
      round,
      toLead,
      ...(notReviewed.length > 0 ? { notReviewed } : {}),
      ...(goesFirst.length > 0 ? { goesFirst } : {})
    };
  }

  const into = await changeApproved(ctx, loaded, approved =>
    buildMergeIntoRun(ctx, loaded, view, start, submitted, onProjectChange, approved)
  ).catch(async (error: unknown) => {
    if (error instanceof RunRefusal && error.code === 'conflict') {
      await recordBrake(ctx, loaded, 'conflict', taskId);
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

  const merged = Object.keys(submitted);
  // What it asked for on a file it then held and merged itself is done; what it asked for on any other goes in now, held
  // by another task or not, when it merges line by line with the run's version — its approved files read it, and a run
  // whose work reads what it lacks fails every task's checks (velada-dress: t-sponsors approved, its tokens waiting on
  // t-home). The holder's copy brings it in at its next refresh. Only what does not merge waits for an integration task.
  const requests = await readRequests(view.paths);
  const own = requests.filter(request => merged.includes(request.file));
  const asked = requests.filter(request => !merged.includes(request.file));
  const went =
    asked.length === 0
      ? undefined
      : await changeApproved(ctx, loaded, approved =>
          buildRequestsMerge(
            ctx,
            loaded,
            asked.map(request => ({ view, request })),
            approved
          )
        );
  const wentIn = went !== undefined && !('failed' in went) ? (went.requests ?? []) : [];
  const fulfilled: string[] = [];
  for (const request of requests) {
    if (own.includes(request) || wentIn.includes(`${taskId}/${request.id}`)) {
      await fs.rm(path.join(view.paths.requests, `${request.id}.json`), { force: true });
      fulfilled.push(request.file);
    }
  }

  const unmergedFiles = asked.filter(request => !fulfilled.includes(request.file)).map(request => request.file);
  const unmerged =
    unmergedFiles.length > 0
      ? {
          files: unmergedFiles,
          reason: went && 'failed' in went ? 'the checks failed with it' : 'it does not merge line by line'
        }
      : undefined;

  const released = [...(await lockedFiles(view.paths)).keys()];
  await fs.rm(view.paths.locks, { recursive: true, force: true });
  await revokeOwner(view.paths);
  await updateState(
    view.paths,
    state => ({
      ...state,
      round,
      status: 'done',
      ...(skipped
        ? {
            design: {
              status: 'skipped' as const,
              round: state.round,
              by: ctx.agent,
              at: at(ctx),
              ...(why ? { why } : {})
            }
          }
        : {})
    }),
    ctx.now
  );
  // Said the moment it is so: the approval is in the run's work, whatever the steps after it meet — written last, one
  // that failed after it left an approval the log never had (la-velada: t-tier-list, approved and nowhere in the log).
  await logRun(ctx, loaded.paths, {
    action: 'review',
    task: taskId,
    verdict,
    round,
    merged,
    fulfilled,
    // Nothing silent: a request that did not go in, and why — its integration task applies it.
    ...(unmerged ? { unmerged } : {}),
    ...(skipped ? { design: 'skipped', ...(why ? { designSkip: why } : {}) } : {}),
    ...(skipped && view.state.design?.by ? { designBy: view.state.design.by } : {})
  });
  await fs.rm(view.paths.cache, { recursive: true, force: true });

  const refreshed = await loadRun(ctx, runId);
  const granted = await grantWaiters(ctx, refreshed, released);
  const settled = await settleRequests(ctx, refreshed, released);
  const ready = await readyWhatWaited(ctx, refreshed);
  const states = await statesOf(refreshed);

  // What another task agreed with this one may wait on this one's work: it is in the run's now — said to each, so an
  // agreement accepted before it could be applied is applied, not forgotten.
  const agreed = (await proposalsOf(refreshed)).filter(
    each => each.from === taskId && each.answer?.verdict === 'accept' && states.get(each.to)?.status !== 'done'
  );
  for (const each of agreed) {
    await sendMessage(ctx, refreshed, {
      from: taskId,
      to: each.to,
      text: `${taskId} is approved: what you agreed with it (${each.id}: ${each.change.slice(0, 160)}${each.change.length > 160 ? '…' : ''}) can be applied now — its files are in the run's work, and your copy brings them with your next complete or plitzi task discard <file>`
    });
  }

  // What the approval let go: the files handed to the tasks waiting for them, and the tasks it made ready.
  if (granted.length > 0 || ready.length > 0) {
    await logRun(ctx, loaded.paths, { action: 'handed-on', task: taskId, granted, ready });
  }

  // A designer at its UI review learns it is decided, never finds out by a refusal (la-velada: design-1 on t-motion).
  const designer = skipped ? view.state.design?.by : undefined;
  if (designer) {
    await sendMessage(ctx, refreshed, {
      from: LEAD,
      to: agentAddress(designer),
      text: `${taskId} is approved without its UI review (the lead went first): drop that review — what you found still matters, tell the lead with plitzi task tell --about ${taskId} "…" --token <yours>`
    });
  }

  // What is connected shows as it is approved: a running preview of the run takes the approved work in now. A preview
  // that cannot take it is said, never the approval undone by it.
  const previewProblem = await syncPreview(refreshed, ctx.root).then(
    () => undefined,
    (error: unknown) => (error instanceof Error ? error.message : String(error))
  );
  if (previewProblem !== undefined) {
    await logRun(ctx, loaded.paths, { action: 'preview-sync-failed', task: taskId, error: previewProblem });
  }

  const integrations = await withLock(refreshed.paths.mergeLock, () => integrateWhenReady(ctx, refreshed), {
    now: ctx.now
  });

  // The last approval — no integration made by it either: every task of the run done.
  await sayIfAllDone(ctx, runId);

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
    ...(previewProblem === undefined ? {} : { previewProblem }),
    settled,
    fulfilled,
    ...(unmerged ? { unmerged } : {}),
    ...(joined.length > 0 ? { joined } : {}),
    ...(skipped ? { design: 'skipped' as const, ...(why ? { designSkip: why } : {}) } : {}),
    ...(notReviewed.length > 0 ? { notReviewed } : {})
  };
};
