import fs from 'node:fs/promises';
import path from 'node:path';

import { approveDesign, assertDesigner, designDue, isLead } from '../design';
import { writeJson } from '../files';
import { LEAD, messagesOf } from '../messages';
import { taskPaths } from '../paths';
import { dependenciesDone } from '../plan';
import { syncPreview } from '../preview';
import { RunRefusal } from '../refusal';
import { assertStatus, loadRun, logRun, readApproved, recordBrake, requireNoTask, requirePerson } from '../run';
import { keepFiles, withLock } from '../store';
import { DEFAULTS, lockedFiles, readRequests, readStart, revokeOwner, updateState, viewTask } from '../taskStore';
import { buildMergeIntoRun, buildRequestMerge, changeApproved } from './approve';
import { at, findTask, refreshCopy } from './common';
import { allLocks, grantWaiters } from './locks';
import { integrateWhenReady, settleRequests } from './requests';

import type { ProjectChange, ReviewComment } from '../model';
import type { RunContext } from '../run';

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
  /** Requests of done tasks on the files it let go of, merged now — and integration tasks left with nothing to do. */
  settled?: string[];
  /** Sent to a person after the round limit. */
  toPerson?: boolean;
  /** Its files a person changed meanwhile, put together with its change (--merge). */
  joined?: string[];
  /** A designer approved its UI — it is the lead's now — or the lead approved it without that review. */
  design?: 'approved' | 'skipped';
}

/**
 * `plitzi task review`: the lead's or a reviewer's verdict on a task in review. Changes go back to the same task
 * with comments, and after the round limit to a person; approval keeps its reviewed version, merges it into the run's
 * work, lets its files go to whoever waits for them, and makes ready what was waiting on it.
 */
export const reviewTask = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  verdict: 'approve' | 'changes',
  comments: ReviewComment[],
  onProjectChange: ProjectChange = 'refuse',
  { skipDesign = false }: { skipDesign?: boolean } = {}
): Promise<ReviewedTask> => {
  requireNoTask(ctx, 'review a task');
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'review a task');
  const task = findTask(loaded, taskId);
  const view = await viewTask(loaded.paths, task);
  // After the round limit it went to a person, who looks at it and may approve it as it is — confirming, as a person.
  const atPerson = view.state.status === 'blocked' && view.state.blockedBy?.review === true;
  if (atPerson && verdict === 'approve') {
    await requirePerson(ctx, runId, `approve task "${taskId}" after its review rounds`);
  } else if (view.state.status !== 'in-review') {
    throw new RunRefusal(
      'invalid',
      atPerson
        ? `Task "${taskId}" went to a person after its review rounds: a person approves it as it is, or answers it (plitzi task unblock ${taskId} --answer "…")`
        : `Task "${taskId}" is ${view.state.status}, not in review`,
      { task: taskId }
    );
  }

  // Its UI waits for a designer: an agent's verdict is the designer's; the lead's approval waits for it, or says it skips.
  const byDesigner = designDue(view.state) && !isLead(ctx.agent);
  if (byDesigner) {
    assertDesigner(view, ctx.agent);
    if (verdict === 'approve') {
      await approveDesign(ctx, loaded, view, comments.map(comment => comment.note).join(' · ') || undefined);

      return { verdict, round: view.state.round, design: 'approved' };
    }
  } else if (verdict === 'approve' && designDue(view.state) && !skipDesign) {
    const by = view.state.design?.by;
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}"'s UI waits for ${by ?? 'a designer'}'s review${by ? '' : ' (none took it yet)'}: run watch --until lead wakes you once it is said — or approve it now without it: --skip-design`,
      { task: taskId, ...(by ? { designer: by } : {}) }
    );
  }

  const skipped = verdict === 'approve' && designDue(view.state);

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
  await writeJson(view.paths.reviewed, {
    round,
    at: at(ctx),
    files: await keepFiles(loaded.paths, view.paths.work, changed)
  });
  await writeJson(view.paths.review, { round, verdict, comments, by: ctx.agent, at: at(ctx) });

  if (verdict === 'changes') {
    const toPerson = round >= DEFAULTS.reviewRounds;
    // It redoes its work on the run as it is now: what was approved while it was in review comes into its copy.
    const brought = toPerson ? [] : await refreshCopy(ctx, loaded, view);
    await updateState(
      view.paths,
      state => ({
        ...state,
        round,
        status: toPerson ? 'blocked' : 'changes-requested',
        ...(toPerson
          ? {
              blockedBy: {
                reason: `${String(round)} rounds of changes: a person looks at it — approves it as it is (plitzi task review ${taskId} --approve), or answers it (plitzi task unblock ${taskId} --answer "…")`,
                needs: 'person' as const,
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
    await logRun(ctx, loaded.paths, { action: 'review', task: taskId, verdict, round });

    return { verdict, round, toPerson };
  }

  const into = await changeApproved(ctx, loaded, approved =>
    buildMergeIntoRun(ctx, loaded, view, start, changed, onProjectChange, approved)
  ).catch(async (error: unknown) => {
    if (error instanceof RunRefusal && error.code === 'conflict') {
      await recordBrake(ctx, loaded, 'conflict');
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

  const merged = [...changed];
  // What it asked for on a file it then held and merged itself is done; what it asked for on a file now free goes in too
  // when it merges line by line with the run's version. Only what neither can do waits for an integration task.
  const locksNow = await allLocks(ctx);
  const fulfilled: string[] = [];
  for (const request of await readRequests(view.paths)) {
    const free = !(locksNow.get(request.file) ?? []).some(
      each => each.live && !(each.run === runId && each.task === taskId)
    );
    const went =
      !merged.includes(request.file) && free
        ? await changeApproved(ctx, loaded, approved => buildRequestMerge(ctx, loaded, view, request, approved))
        : undefined;
    const done = merged.includes(request.file) || (went !== undefined && !('failed' in went));
    if (done) {
      await fs.rm(path.join(view.paths.requests, `${request.id}.json`), { force: true });
      fulfilled.push(request.file);
    }
  }

  const released = [...(await lockedFiles(view.paths)).keys()];
  await fs.rm(view.paths.locks, { recursive: true, force: true });
  await revokeOwner(view.paths);
  await updateState(
    view.paths,
    state => ({
      ...state,
      round,
      status: 'done',
      ...(skipped ? { design: { status: 'skipped' as const, round: state.round, by: ctx.agent, at: at(ctx) } } : {})
    }),
    ctx.now
  );
  await fs.rm(view.paths.cache, { recursive: true, force: true });

  const refreshed = await loadRun(ctx, runId);
  const granted = await grantWaiters(ctx, refreshed, released);
  const settled = await settleRequests(ctx, refreshed, released);
  const states = new Map(
    await Promise.all(
      refreshed.tasks.map(async each => [each.id, (await viewTask(refreshed.paths, each)).state] as const)
    )
  );
  const ready: string[] = [];
  for (const each of refreshed.tasks) {
    if (states.get(each.id)?.status === 'pending' && dependenciesDone(each, states)) {
      await updateState(taskPaths(refreshed.paths, each.id), state => ({ ...state, status: 'ready' }), ctx.now);
      ready.push(each.id);
    }
  }

  // What is connected shows as it is approved: a running preview of the run takes the approved work in now.
  await syncPreview(refreshed, ctx.root);
  const integrations = await withLock(refreshed.paths.mergeLock, () => integrateWhenReady(ctx, refreshed), {
    now: ctx.now
  });
  await logRun(ctx, loaded.paths, {
    action: 'review',
    task: taskId,
    verdict,
    round,
    merged,
    fulfilled,
    granted,
    ready,
    integrations
  });

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
    settled,
    ...(joined.length > 0 ? { joined } : {}),
    ...(skipped ? { design: 'skipped' as const } : {})
  };
};
