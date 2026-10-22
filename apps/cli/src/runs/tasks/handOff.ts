import { agentAddress, LEAD, sendMessage } from '../messages';
import { RunRefusal } from '../refusal';
import { loadRun, logRun } from '../run';
import { cutTask, viewTask } from '../taskStore';
import { roleOf } from './common';

import type { RunContext } from '../run';
import type { TaskView } from '../taskStore';

/**
 * A task sent back while its agent is at another one waits for that agent — one agent, one task at a time — while the
 * others of its role have nothing: velada-polish's dev-1 held four tasks, two sent back at once, and t-match-bars's
 * changes waited ten minutes for it while dev-2 and dev-3 waited for work, and stopped. Past `HAND_OFF_AFTER_MS`, a
 * free agent of its role is handed it: its copy made again from the version that went to review — nothing written
 * since, or it is not handed — and its review's asks with it.
 */

/** How long a sent-back task waits for its agent at another task before a free agent of its role is offered it. */
export const HAND_OFF_AFTER_MS = 3 * 60_000;

export interface Rework {
  view: TaskView;
  /** Whose it is: the agent at another task. */
  from: string;
  /** The task that agent is at. */
  at: string;
  /** When it was sent back, in ms. */
  since: number;
}

const atWork = (view: TaskView): boolean =>
  view.state.status === 'in-progress' || view.state.status === 'changes-requested';

/**
 * Each task sent back whose agent is at another — nothing done on it since its review sent it back — of `roles`, never
 * the caller's own: the one sent back longest first.
 */
export const reworksWaiting = (
  views: readonly TaskView[],
  agent: string,
  roles: readonly string[] | undefined
): Rework[] =>
  views
    .flatMap((view): Rework[] => {
      const from = view.owner?.agent;
      const { review } = view;
      if (
        view.state.status !== 'changes-requested' ||
        from === undefined ||
        from === agent ||
        review?.verdict !== 'changes' ||
        (roles !== undefined && !roles.includes(roleOf(view.task)))
      ) {
        return [];
      }

      const since = Date.parse(review.at);
      // Its agent did something on it since — took it up, wrote in its copy: it is at it, and keeps it.
      if ((view.workedAt ?? 0) > since) {
        return [];
      }

      const other = views.find(
        each =>
          each !== view && each.owner?.agent === from && atWork(each) && (each.workedAt ?? 0) > (view.workedAt ?? 0)
      );

      return other ? [{ view, from, at: other.task.id, since }] : [];
    })
    .sort((a, b) => a.since - b.since);

/** Of the reworks waiting, the one a free agent is handed now — and the next one's time, when none is yet. */
export const reworkFor = (
  reworks: readonly Rework[],
  now: number
): { now?: Rework; later?: { rework: Rework; at: number } } => {
  const due = reworks.find(each => now - each.since >= HAND_OFF_AFTER_MS);
  const next = reworks.at(0);

  return due ? { now: due } : next ? { later: { rework: next, at: next.since + HAND_OFF_AFTER_MS } } : {};
};

/**
 * The rework handed to the caller: its agent's token cut — told why — and the task ready again, for the caller to
 * take. Refused when its agent took it up meanwhile: it is that agent's again.
 */
export const handOffRework = async (ctx: RunContext, runId: string, taskId: string, from: string): Promise<void> => {
  const loaded = await loadRun(ctx, runId);
  const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
  const still = reworksWaiting(views, ctx.agent, undefined).find(
    each => each.view.task.id === taskId && each.from === from
  );
  if (!still) {
    throw new RunRefusal('claimed', `${taskId} is ${from}'s again: it took it up meanwhile`, {
      task: taskId,
      holder: from
    });
  }

  await cutTask(still.view, `handed to ${ctx.agent}: ${from} was at ${still.at}`, ctx.now);
  await sendMessage(ctx, loaded, {
    from: LEAD,
    to: agentAddress(from),
    text: `${taskId}'s changes went to ${ctx.agent}: you were at ${still.at}, and it waited — it is not yours now; go on with ${still.at}`
  });
  await logRun(ctx, loaded.paths, { action: 'handed-off', task: taskId, from, to: ctx.agent, at: still.at });
};
