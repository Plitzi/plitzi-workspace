import { assertReviewingLead, isPrincipal } from '../leads';
import { agentAddress, LEAD, sendMessage } from '../messages';
import { RunRefusal } from '../refusal';
import { letGoUi } from '../reviewQueue';
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

  await assertReviewingLead(ctx, loaded, view);
  const after = await updateState(
    view.paths,
    state => ({
      ...state,
      status: 'blocked',
      reviewer: undefined,
      ...(state.design ? { design: letGoUi(state.design) } : {}),
      blockedBy: {
        reason: `escalated by ${ctx.agent}: ${why} — the lead decides: approves it as it is (plitzi task review ${taskId} --approve), or settles it with an answer that sends it back (plitzi task unblock ${taskId} --answer "…")`,
        needs: 'lead',
        review: true
      },
      notes: [...state.notes, { at: at(ctx), by: ctx.agent, text: `Escalated to the lead: ${why}` }]
    }),
    ctx.now
  );
  // No message to the lead: the block, saying why and how to decide it, is what wakes it. A designer at its UI is told
  // its review ends, as a task sent back tells it.
  const designer = view.state.design?.status === 'due' ? view.state.design.by : undefined;
  if (designer !== undefined && designer !== ctx.agent) {
    await sendMessage(ctx, loaded, {
      from: LEAD,
      to: agentAddress(designer),
      text: `${ctx.agent} escalated ${taskId} to the lead while you reviewed its UI: your review of this round ends — what you found still matters, tell the lead with plitzi task tell --about ${taskId} "…"`
    });
  }

  await logRun(ctx, loaded.paths, { action: 'review-escalated', task: taskId, why });
  await logSpent(ctx, loaded, taskId, 'review');

  return after;
};
