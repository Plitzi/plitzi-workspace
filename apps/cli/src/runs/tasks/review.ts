import fs from 'node:fs/promises';
import path from 'node:path';

import { approveDesign, assertDesigner, designDue, reviewTimeOf, timedOut } from '../design';
import { writeJson } from '../files';
import { assertReviewingLead, isCoLead, isPrincipal } from '../leads';
import { agentAddress, LEAD, messagesOf, sendMessage, unreadFor } from '../messages';
import { taskPaths } from '../paths';
import { RunRefusal } from '../refusal';
import { assertStatus, loadRun, logRun, readRunLog, recordBrake, requireNoTask } from '../run';
import { logSpent } from '../spent';
import { keepFiles, withLock } from '../store';
import { DEFAULTS, readRequests, readStart, updateState, viewTask } from '../taskStore';
import { DESIGNER, readTeam, startedAgents, TEAM_FILE } from '../team';
import { buildMergeIntoRun, buildRequestsMerge, changeApproved } from './approve';
import { closeApproved } from './closeApproved';
import { at, findTask, refreshCopy } from './common';
import { besideHint, partnerFor, reviewedBeside, writtenSince } from './pairApproval';

import type { DesignSkip } from '../designSkip';
import type { ProjectChange, ReviewComment, TaskState } from '../model';
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
  /** `skipped` while a designer was at that review: who — told to drop it, and said to the lead. */
  designBy?: string;
  /** Written in its copy after it went to review: not part of what was reviewed, so not merged. */
  notReviewed?: string[];
  /** Approved beside it as one change (`--with`): that task, and its files that went in. */
  with?: { task: string; merged: string[] };
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
      } or the lead review ${taskId}'s UI — the lead, as itself: plitzi task review ${taskId} --approve`,
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

/**
 * Whether asking for changes now blocks the task for the lead: its rounds of this kind — the designer's on its UI, the
 * lead's on the rest — at their limit with this one. Said to the reviewer before it asks (`task next`), never found out
 * after (design-2's third round on t-overlay).
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
/** Whether `agent` looked at the task (`task look`) since its last completion: what a lead's UI review is. */
const lookedSince = async (loaded: LoadedRun, agent: string, taskId: string): Promise<boolean> => {
  const log = await readRunLog(loaded.paths);
  const completed = log.findLast(entry => entry.action === 'complete' && entry.task === taskId);
  const since = typeof completed?.at === 'string' ? Date.parse(completed.at) : 0;

  return log.some(
    entry =>
      entry.action === 'look' &&
      entry.task === taskId &&
      entry.by === agent &&
      typeof entry.at === 'string' &&
      Date.parse(entry.at) >= since
  );
};

export const reviewTask = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  verdict: 'approve' | 'changes',
  comments: ReviewComment[],
  onProjectChange: ProjectChange = 'refuse',
  options: { skipDesign?: DesignSkip; with?: string } = {}
): Promise<ReviewedTask> => {
  requireNoTask(ctx, 'review a task');
  const loaded = await loadRun(ctx, runId);
  if (options.with !== undefined && verdict !== 'approve') {
    throw new RunRefusal('invalid', '--with approves two tasks as one change: it goes with --approve', {
      task: taskId
    });
  }

  // One verdict at a time on a task: two leads saying one at once, the second reads the first's — never both merged.
  const locked = (id: string, then: () => Promise<ReviewedTask>): Promise<ReviewedTask> =>
    withLock(taskPaths(loaded.paths, findTask(loaded, id).id).reviewLock, then, {
      now: ctx.now,
      ttlMs: 15 * 60_000,
      waitMs: 5 * 60_000
    });
  const partner = options.with;

  return locked(taskId, () =>
    partner === undefined
      ? decide(ctx, runId, taskId, verdict, comments, onProjectChange, options)
      : locked(partner, () => decide(ctx, runId, taskId, verdict, comments, onProjectChange, options))
  );
};

const decide = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  verdict: 'approve' | 'changes',
  comments: ReviewComment[],
  onProjectChange: ProjectChange,
  { skipDesign, with: withId }: { skipDesign?: DesignSkip; with?: string }
): Promise<ReviewedTask> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'review a task');
  const task = findTask(loaded, taskId);
  const view = await viewTask(loaded.paths, task);
  // Past the round limit it is the lead's to decide — the lead speaks to the person, if it must ask — never an agent's:
  // A run's t-boxer waited for "a person" nobody in the run was.
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
        : view.state.status === 'changes-requested' && !isPrincipal(ctx.agent)
          ? // A run's design-1 measured round 2, and its approval was refused with the status alone.
            `Task "${taskId}" was sent back meanwhile (round ${String(view.state.round)}): there is no review to say now — what you measured, tell the lead (plitzi task tell --about ${taskId} "…"); its next round comes to review again`
          : view.state.status === 'done'
            ? `Task "${taskId}" is approved already: there is no review to say — what you found, tell the lead (plitzi task tell --about ${taskId} "…")`
            : `Task "${taskId}" is ${view.state.status}, not in review`,
      { task: taskId }
    );
  }

  // Never one's own: a run's lead took a ready task, wrote it and approved it, nobody else reading a line.
  if (view.owner?.agent === ctx.agent) {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}" is yours: another reviews it — a tester or a lead that reviews takes it from the queue (plitzi run agent lead-2 --launch starts one)`,
      { task: taskId }
    );
  }

  // A UI review another designer holds now — its own timed out, or the lead's — is refused as that first, naming why:
  // what the lead said meanwhile is no reason to say the verdict again.
  if (designDue(view.state) && !isPrincipal(ctx.agent) && !isCoLead(loaded.record, ctx.agent)) {
    assertDesigner(view, ctx.agent);
  }

  // What the lead said to a reviewer while it reviewed is read before its verdict, not after: design-1's round on
  // t-match-bars went out before the lead's "only the bars this round" reached it. Handed over here,
  // read; said again, the verdict goes.
  if (!isPrincipal(ctx.agent)) {
    const meanwhile = (await unreadFor(loaded, agentAddress(ctx.agent), true)).filter(message => message.from === LEAD);
    if (meanwhile.length > 0) {
      throw new RunRefusal(
        'invalid',
        `The lead said this to you while you reviewed — read it before your verdict on ${taskId}, then say it again with it in mind:\n${meanwhile.map(message => `  ${message.id}: ${message.text}`).join('\n')}`,
        {
          task: taskId,
          messages: meanwhile.map(message => message.id),
          next: `read ${meanwhile.map(message => message.id).join(', ')} above — it is marked read now — then say your verdict on ${taskId} again with it in mind`
        }
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
        `--skip-design is a lead's: ${ctx.agent} is not one. A lead approves without the UI review as itself — plitzi task review ${taskId} --approve --skip-design lead`,
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
      `Task "${taskId}"'s UI waits for ${by ?? 'a designer'}'s review${by ? '' : ' (none took it yet)'}: run watch wakes you once it is said — or approve it now without it, saying why: --skip-design lead (you looked at its UI yourself, as a designer would) or --skip-design no-ui (it changes nothing a visitor sees)`,
      { task: taskId, ...(by ? { designer: by } : {}) }
    );
  }

  const skipped = verdict === 'approve' && designDue(view.state);
  const why = skipped ? skipDesign : undefined;
  // A designer at it, in its time: its review is cut from under it — its copy taken away mid-look (a run's design-1,
  // four minutes into d-brand-logo's). Past its time it is the lead's to decide, as `slow-review` says.
  const reviewing = view.state.design?.by;
  if (
    why !== undefined &&
    reviewing !== undefined &&
    reviewing !== ctx.agent &&
    timedOut(view.state.design, ctx.now().getTime()) === undefined
  ) {
    const left = Math.max(
      1,
      Math.ceil(
        (Date.parse(view.state.design?.at ?? ctx.now().toISOString()) +
          reviewTimeOf(view.state.design) -
          ctx.now().getTime()) /
          60_000
      )
    );
    throw new RunRefusal(
      'claimed',
      `${reviewing} is reviewing ${taskId}'s UI — its own for ${String(left)} min more: approving past it takes its copy from under it. Wait for its verdict (plitzi run watch wakes you), or ask it where it stands (plitzi task message @${reviewing} "…"); past its time it is yours to decide.`,
      { task: taskId, designer: reviewing }
    );
  }
  // The lead's UI review is a look at it, said: a run's lead approved t-reactions-quiet `--skip-design lead` without
  // one, and the emoji sat at the top of every key — the person saw it, no check could.
  if (why === 'lead' && !(await lookedSince(loaded, ctx.agent, taskId))) {
    throw new RunRefusal(
      'invalid',
      `--skip-design lead says you reviewed ${taskId}'s UI yourself, and you have not looked at it since it was completed: plitzi task look ${taskId} (both schemes, the phone width), then approve`,
      { task: taskId }
    );
  }

  // The lead sent back a task a designer was reviewing: its review ends now, and it is told — never left to say a
  // verdict that is refused (design-1's of t-result-card was turned away, naming nothing). An approval
  // tells it once the approval is in (below).
  const cut = verdict === 'changes' && !byDesigner && designDue(view.state) ? view.state.design?.by : undefined;
  if (cut !== undefined && cut !== ctx.agent) {
    await sendMessage(ctx, loaded, {
      from: LEAD,
      to: agentAddress(cut),
      text: `${ctx.agent} sent ${taskId} back while you reviewed its UI: your review of this round ends — what you found still matters, tell the lead with plitzi task tell --about ${taskId} "…"`
    });
  }

  // A reviewer that took this round's review and is still at it is told its review ends — a run's tester read on as
  // the lead approved, the task's copy gone under it, and its own verdict refused "approved already".
  const holder = view.state.reviewer;
  if (holder && holder.by !== ctx.agent && holder.round === view.state.round && !byDesigner) {
    await sendMessage(ctx, loaded, {
      from: LEAD,
      to: agentAddress(holder.by),
      text: `${ctx.agent} decided ${taskId} (${verdict === 'approve' ? 'approved' : 'sent back'}) while you reviewed it: your review of this round ends — what you found still matters, tell the lead with plitzi task tell --about ${taskId} "…"; then plitzi task next`
    });
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

  const partner = withId === undefined ? undefined : await partnerFor(ctx, loaded, taskId, withId);
  const round = view.state.round + 1;
  const changed = view.state.changed ?? [];
  // What went to review is what is reviewed: written in the copy after `complete`, a change is not part of this round.
  const submitted = view.state.submitted ?? (await keepFiles(loaded.paths, view.paths.work, changed));
  const notReviewed = await writtenSince(view, start, submitted);
  // Its requests too, at the version it asked: a copy made again from this (taken by another agent, or after a cut) holds
  // what it asked of a shared file — a run's t-blog came back without its site.json, and author failed on it.
  const requested = Object.fromEntries((await readRequests(view.paths)).map(request => [request.file, request.wanted]));
  await writeJson(view.paths.reviewed, { round, at: at(ctx), files: { ...requested, ...submitted } });
  await writeJson(view.paths.review, { round, verdict, comments, by: ctx.agent, at: at(ctx) });

  if (verdict === 'changes') {
    // Counted apart: the designer's rounds on its UI, and the lead's on the rest — each kind to its own limit.
    const designRounds = (view.state.designRounds ?? 0) + (byDesigner ? 1 : 0);
    const ofKind = byDesigner ? designRounds : round - designRounds;
    const toLead = changesBlock(view.state, byDesigner);
    // It redoes its work on the run as it is now: what was approved while it was in review comes into its copy.
    const brought = toLead ? [] : await refreshCopy(ctx, loaded, view);
    // The lead says the next round's UI review is its own: it comes to it, never offered to a designer.
    const reserving = !byDesigner && skipDesign === 'lead';
    await updateState(
      view.paths,
      state => ({
        ...state,
        round,
        ...(designRounds > 0 ? { designRounds } : {}),
        ...(reserving
          ? { design: { ...(state.design ?? { status: 'skipped' as const, round: state.round }), reserved: ctx.agent } }
          : {}),
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
    await logSpent(ctx, loaded, taskId, 'review');
    const goesFirst = toLead ? [] : await tellItGoesFirst(ctx, loaded, view);

    return {
      verdict,
      round,
      toLead,
      ...(notReviewed.length > 0 ? { notReviewed } : {}),
      ...(goesFirst.length > 0 ? { goesFirst } : {})
    };
  }

  const merged = Object.keys(submitted);
  // What it asked for on a file it then held and merged itself is done; what it asked for on any other goes in now, held
  // by another task or not, when it merges line by line with the run's version — its approved files read it, and a run
  // whose work reads what it lacks fails every task's checks (t-sponsors approved, its tokens waiting on
  // t-home). The holder's copy brings it in at its next refresh. Only what does not merge waits for an integration task.
  const requests = await readRequests(view.paths);
  const own = requests.filter(request => merged.includes(request.file));
  const asked = requests.filter(request => !merged.includes(request.file));
  if (partner && asked.length > 0) {
    throw new RunRefusal(
      'invalid',
      `--with ${partner.view.task.id}: ${taskId} asks changes of shared files, which go in through its own approval — approve one of them on its own first`,
      { task: taskId }
    );
  }

  const onConflict = async (error: unknown): Promise<never> => {
    if (error instanceof RunRefusal && error.code === 'conflict') {
      await recordBrake(ctx, loaded, 'conflict', taskId);
    }

    throw error;
  };
  // Its files and what it asked of shared files are one change, checked as one: apart, a run's t-shell went in
  // reading site.json keys and tokens its requests held — files new to the run were never checked — and every copy made
  // after failed typecheck until three integration tasks put them back together.
  const together =
    asked.length === 0
      ? undefined
      : await changeApproved(
          ctx,
          loaded,
          async approved => {
            const files = await buildMergeIntoRun(ctx, loaded, view, start, submitted, onProjectChange, approved);
            const withAsked = await buildRequestsMerge(
              ctx,
              loaded,
              asked.map(request => ({ view, request })),
              files.next
            );

            return withAsked
              ? { next: withAsked.next, merged: [...files.merged, ...withAsked.merged], requests: withAsked.requests }
              : files;
          },
          { checkAlways: true }
        ).catch(onConflict);
  const togetherIn = together !== undefined && !('failed' in together);
  // Else its files alone — checked whatever they merged when it asked anything, so they go in only reading what is there.
  const into = togetherIn
    ? together
    : await changeApproved(
        ctx,
        loaded,
        async approved => {
          const files = await buildMergeIntoRun(ctx, loaded, view, start, submitted, onProjectChange, approved);
          if (!partner) {
            return files;
          }

          const beside = await buildMergeIntoRun(
            ctx,
            loaded,
            partner.view,
            partner.start,
            partner.submitted,
            onProjectChange,
            files.next
          );

          return { next: beside.next, merged: [...files.merged, ...beside.merged] };
        },
        { checkAlways: asked.length > 0 || partner !== undefined }
      ).catch(onConflict);
  if (into && 'failed' in into) {
    const failing = into.failed.steps.filter(step => !step.ok);
    throw new RunRefusal(
      'conflict',
      asked.length > 0
        ? `Task "${taskId}"'s files fail the project's checks (${failing.map(step => step.name).join(', ')}) without what it asked of ${asked.map(request => request.file).join(', ')}, and with it: nothing was merged — send it back (--changes) to redo it on the run's version`
        : `Task "${taskId}"'s change${partner ? ` beside ${partner.view.task.id}'s` : ''}, put together with the run's newer version, fails the project's checks (${failing.map(step => step.name).join(', ')}): nothing was merged — send it back (--changes) to redo it on the run's version${await besideHint(loaded, taskId, partner)}`,
      { task: taskId, steps: failing }
    );
  }

  const went = togetherIn
    ? together
    : asked.length === 0
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
          // Which checks, named: "the checks failed with it" alone left the lead guessing a task's from a run-wide one.
          reason:
            went && 'failed' in went
              ? `the checks failed with it (${went.failed.steps
                  .filter(step => !step.ok)
                  .map(step => step.name)
                  .join(', ')})`
              : 'it does not merge line by line'
        }
      : undefined;

  const closed = await closeApproved(ctx, loaded, view, {
    round,
    merged,
    fulfilled,
    ...(unmerged ? { unmerged } : {}),
    ...(skipped ? { skipped: true as const, ...(why ? { why } : {}) } : {}),
    notReviewed
  });
  if (!partner) {
    return closed;
  }

  // In beside it, as one change: its review said now, then closed as an approval of its own.
  await reviewedBeside(ctx, partner, taskId, comments);
  const besideClosed = await closeApproved(ctx, loaded, partner.view, {
    round: partner.round,
    merged: Object.keys(partner.submitted),
    fulfilled: [],
    notReviewed: partner.notReviewed
  });

  return { ...closed, with: { task: partner.view.task.id, merged: besideClosed.merged ?? [] } };
};
