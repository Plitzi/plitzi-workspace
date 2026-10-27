import fs from 'node:fs/promises';
import path from 'node:path';

import { buildMergeIntoRun, buildRequestsMerge, changeApproved } from './approve';
import { closeApproved } from './closeApproved';
import { at, findTask, refreshCopy } from './common';
import { besideHint, partnerFor, reviewedBeside, writtenSince } from './pairApproval';
import { approveResearch, dropProposal } from './research';
import { assertStepReviewer, letGoStep, nextStep, reviewSteps, reviewTeamOf } from './reviews';
import { isPrincipal } from '../agents/leads';
import { writeJson } from '../core/files';
import { taskPaths } from '../core/paths';
import { RunRefusal } from '../core/refusal';
import { keepFiles, withLock } from '../core/store';
import { DEFAULTS, readRequests, readStart, updateState, viewTask } from '../core/taskStore';
import { isResearch } from '../plan/spike';
import { logSpent } from '../report/spent';
import { assertStatus, loadRun, logRun, recordBrake, requireNoTask } from '../run';
import { agentAddress, LEAD, markRead, messagesOf, sendMessage, unreadFor } from '../talk/messages';

import type { ProjectChange, ReviewComment, TaskState } from '../core/model';
import type { TaskView } from '../core/taskStore';
import type { LoadedRun, RunContext } from '../run';

/**
 * `plitzi task review`: a verdict on the step of its review a card waits for (`reviews.ts`) — its reviewer's, or the
 * lead's on any.
 */

export interface ReviewedTask {
  verdict: 'approve' | 'changes';
  round: number;
  /**
   * Approved from a shell inside its copy: the copy left there for it, going with the run — and the project to go back
   * to before the next command.
   */
  copyLeft?: string;
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
  /** A step approved, not the last: the role whose step it was, and the role whose step is next. */
  passed?: { role: string; next: string };
  /** Written in its copy after it went to review: not part of what was reviewed, so not merged. */
  notReviewed?: string[];
  /** A research card approved: the tasks it stacked, those the lead left out (`--leave`), and what their check said. */
  found?: { added: string[]; left: string[]; notices?: string[]; stage?: string };
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

/** What `taskId`'s copy holds that did not go to review — what `task look` would serve the lead without it being so. */
export const notReviewedIn = async (ctx: RunContext, runId: string, taskId: string): Promise<string[]> => {
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  const view = await viewTask(loaded.paths, findTask(loaded, taskId));
  const start = await readStart(view.paths);

  return start && view.state.submitted ? writtenSince(view, start, view.state.submitted) : [];
};

/**
 * Whether asking for changes now blocks the task for the lead: its rounds at their limit with this one, whichever step
 * asks. Said to the reviewer before it asks (`task next`), never found out after (design-2's third round on t-overlay).
 */
export const changesBlock = (state: Pick<TaskState, 'round'>): boolean => state.round + 1 >= DEFAULTS.reviewRounds;

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
  options: { with?: string; leave?: readonly string[] | 'all' } = {}
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
  { with: withId, leave }: { with?: string; leave?: readonly string[] | 'all' }
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
      `Task "${taskId}" is yours: another reviews it — a tester that did not work it, or the lead`,
      { task: taskId }
    );
  }

  // A verdict on the step it waits for: that step's reviewer's, or the lead's on any.
  await assertStepReviewer(ctx, loaded, view);
  const team = await reviewTeamOf(ctx.root);
  const steps = reviewSteps(task, team);
  const review = view.state.review ?? { round: view.state.round, step: 0, since: view.state.updatedAt };
  const role = steps.at(review.step) ?? LEAD;

  // Only what is about this task holds it — a message naming it, or naming no task of the run; one about another task
  // reaches the agent with its next command (a run's test-1 sent a verdict twice for a note on another card).
  if (!isPrincipal(ctx.agent)) {
    const ids = new Set(loaded.tasks.map(task => task.id));
    const named = (text: string): Set<string> => new Set(text.match(/[\w-]+/g)?.filter(word => ids.has(word)) ?? []);
    const meanwhile = (await unreadFor(loaded, agentAddress(ctx.agent), false)).filter(message => {
      const tasks = named(message.text);

      return message.from === LEAD && (tasks.size === 0 || tasks.has(taskId));
    });
    await markRead(
      loaded,
      agentAddress(ctx.agent),
      meanwhile.map(message => message.id)
    );
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

  if (leave !== undefined && !(isResearch(task) && verdict === 'approve')) {
    throw new RunRefusal(
      'invalid',
      `--leave says which tasks a research card's approval leaves out: ${taskId} ${isResearch(task) ? 'is sent back, nothing stacked' : 'is no research card'}`,
      { task: taskId }
    );
  }

  // A research card's approval stacks what it found — no file of it merged.
  if (isResearch(task) && verdict === 'approve') {
    return approveResearch(ctx, loaded, view, leave);
  }

  // A step approved that is not the last — by its reviewer, never the lead's last word — hands the card to the next.
  const passed = verdict === 'approve' && !isPrincipal(ctx.agent) && review.step + 1 < steps.length;
  if (passed) {
    const next = nextStep(review, steps, at(ctx));
    const nextRole = steps.at(review.step + 1) ?? LEAD;
    const note = comments.map(comment => comment.note).join(' · ');
    await updateState(
      view.paths,
      state => ({
        ...state,
        ...('review' in next ? { review: next.review } : {}),
        notes: [
          ...state.notes,
          {
            at: at(ctx),
            by: ctx.agent,
            text: `Its ${role}'s review approved by ${ctx.agent}: its ${nextRole}'s now${note ? ` — ${note}` : ''}`
          }
        ]
      }),
      ctx.now
    );
    await logRun(ctx, loaded.paths, { action: 'review', task: taskId, verdict, round: view.state.round, step: role });
    await logSpent(ctx, loaded, taskId, 'review');

    return { verdict, round: view.state.round, passed: { role, next: nextRole } };
  }

  // A reviewer that took this round's review and is still at it is told its review ends — a run's tester read on as
  // the lead approved, the task's copy gone under it, and its own verdict refused "approved already".
  const holder = review.by;
  if (holder !== undefined && holder !== ctx.agent) {
    await sendMessage(ctx, loaded, {
      from: LEAD,
      to: agentAddress(holder),
      text: `${ctx.agent} decided ${taskId} (${verdict === 'approve' ? 'approved' : 'sent back'}) while you reviewed it: your review of this round ends — what you found still matters, tell the lead with plitzi task tell --about ${taskId} "…"; then plitzi task next`
    });
  }

  // A question it asked the lead and the lead has not answered: the answer may change the work, so it comes first.
  const answered = new Set((await messagesOf(loaded)).flatMap(message => (message.replyTo ? [message.replyTo] : [])));
  const open = (await messagesOf(loaded)).filter(
    message => message.from === taskId && message.to === LEAD && !message.fyi && !answered.has(message.id)
  );
  if (verdict === 'approve' && open.length > 0) {
    const asked = open.map(
      message => `${message.id} ("${message.text.slice(0, 80)}${message.text.length > 80 ? '…' : ''}")`
    );
    throw new RunRefusal(
      'invalid',
      // The answer is the lead's (`task message` speaks as it): a tester hands the review over with the question.
      isPrincipal(ctx.agent)
        ? `Task "${taskId}" asked ${asked.join(', ')} and it is not answered: answer it first (plitzi task message ${taskId} "…" --reply-to ${open[0].id}) — if the answer changes the work, send it back with it (plitzi task review ${taskId} --changes "…")`
        : `Task "${taskId}" asked the lead ${asked.join(', ')} and it is not answered: the answer may change the work, and it is the lead's — hand it the review: plitzi task review ${taskId} --escalate "approve once ${open[0].id} is answered"`,
      { task: taskId, questions: open.map(message => message.id) }
    );
  }

  if (verdict === 'changes' && comments.length === 0) {
    throw new RunRefusal(
      'invalid',
      'Changes are asked for with what to change: plitzi task review <task> --changes "…"'
    );
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
    // What a research card proposed goes with it: its next round proposes again.
    if (isResearch(task)) {
      await dropProposal(ctx, view);
    }

    // Its next round says its own progress: a run's scope, sent back, read "writing the stage · 75 %" from the last.
    if (view.progress) {
      await writeJson(view.paths.progress, { heartbeatAt: view.progress.heartbeatAt });
    }

    const toLead = changesBlock(view.state);
    // It redoes its work on the run as it is now: what was approved while it was in review comes into its copy.
    const brought = toLead ? [] : await refreshCopy(ctx, loaded, view);
    await updateState(
      view.paths,
      state => ({
        ...state,
        round,
        // Its step, taken, is let go: the task left review — its reviewer is the one before, offered it first.
        ...(state.review ? { review: letGoStep(state.review) } : {}),
        status: toLead ? 'blocked' : 'changes-requested',
        ...(toLead
          ? {
              blockedBy: {
                reason: `${String(round)} rounds of its review’s changes: the lead decides — approves it as it is (plitzi task review ${taskId} --approve), settles what is left with an answer (plitzi task unblock ${taskId} --answer "…"), or asks the person`,
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
            kind: 'review' as const,
            round,
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
    await logRun(ctx, loaded.paths, { action: 'review', task: taskId, verdict, round, step: role });
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
        ? `Task "${taskId}"'s files fail the project's checks (${failing.map(step => step.name).join(', ')}) without what it asked of ${asked.map(request => request.file).join(', ')}, and with it: nothing was merged — send it back (plitzi task review ${taskId} --changes "…") to redo it on the run's version`
        : `Task "${taskId}"'s change${partner ? ` beside ${partner.view.task.id}'s` : ''}, put together with the run's newer version, fails the project's checks (${failing.map(step => step.name).join(', ')}): nothing was merged — send it back (plitzi task review ${taskId} --changes "…") to redo it on the run's version${await besideHint(loaded, taskId, partner)}`,
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
    notReviewed,
    step: isPrincipal(ctx.agent) ? LEAD : role
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
