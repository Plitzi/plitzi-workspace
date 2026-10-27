import { isPrincipal } from '../leads';
import { RunRefusal } from '../refusal';
import { assertStepReviewer, letGoStep } from '../reviews';
import { assertStatus, loadRun, logRun, requireNoTask } from '../run';
import { logSpent } from '../spent';
import { updateState, viewTask } from '../taskStore';
import { at, findTask } from './common';

import type { TaskState } from '../model';
import type { RunContext } from '../run';

/**
 * `plitzi task review <task> --escalate "…"`, a tester's: a review it cannot decide — what was asked reads two ways, a
 * change past the task, a disagreement with its developer — handed to the lead, the manager, who decides it: approves it
 * as it is (`task review --approve`), or settles it with an answer (`task unblock --answer`), which sends it back to its
 * agent with it. Blocked on the lead as a task past its review rounds is: the lead reviews nothing else a tester takes.
 */
export const escalateReview = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  why: string
): Promise<TaskState> => {
  requireNoTask(ctx, 'escalate a review');
  if (isPrincipal(ctx.agent)) {
    throw new RunRefusal(
      'invalid',
      `You are the lead: decide ${taskId} — plitzi task review ${taskId} --approve | --changes "…"`,
      { task: taskId }
    );
  }

  if (why.trim() === '') {
    throw new RunRefusal(
      'invalid',
      'Say what the lead decides: plitzi task review <task> --escalate "what is unclear"'
    );
  }

  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'escalate a review');
  const view = await viewTask(loaded.paths, findTask(loaded, taskId));
  if (view.state.status !== 'in-review') {
    throw new RunRefusal('invalid', `Task "${taskId}" is ${view.state.status}, not in review: nothing to escalate`, {
      task: taskId
    });
  }

  await assertStepReviewer(ctx, loaded, view);
  const after = await updateState(
    view.paths,
    state => ({
      ...state,
      status: 'blocked',
      // Its step let go: the review goes to the lead, who held it is the one before.
      ...(state.review ? { review: letGoStep(state.review) } : {}),
      blockedBy: {
        reason: `escalated by ${ctx.agent}: ${why} — the lead decides: approves it as it is (plitzi task review ${taskId} --approve), or settles it with an answer that sends it back (plitzi task unblock ${taskId} --answer "…")`,
        needs: 'lead',
        review: true
      },
      notes: [...state.notes, { at: at(ctx), by: ctx.agent, text: `Escalated to the lead: ${why}` }]
    }),
    ctx.now
  );
  // No message to the lead: the block, saying why and how to decide it, is what wakes it.

  await logRun(ctx, loaded.paths, { action: 'review-escalated', task: taskId, why });
  await logSpent(ctx, loaded, taskId, 'review');

  return after;
};
