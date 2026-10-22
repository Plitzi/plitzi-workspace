import { extendRun } from '../extend';
import { isCoLead, requireLead } from '../leads';
import { LEAD, sendMessage } from '../messages';
import { RunRefusal } from '../refusal';
import { assertStatus, loadRun, logRun, requireNoTask } from '../run';
import { isResearch } from '../spike';
import { updateState, viewTask } from '../taskStore';
import { isWorked } from '../worked';
import { at, findTask, holderOf } from './common';
import { readyWhatWaited, sayIfAllDone } from './handOn';

import type { TaskStatus } from '../model';
import type { RunContext } from '../run';
import type { Finding } from '../spike';

export interface Spiked {
  task: string;
  status: TaskStatus;
  /** What it set out to find, or found. */
  question: string;
  finding?: Finding;
  /** The tasks it made — its result, stacked on the run — by id. */
  added?: string[];
  /** The tasks it left ready: those it made, and those that waited for it. */
  ready?: string[];
  /** What the check of the tasks it made says and refuses nothing for: a value no check measures, an id not there. */
  notices?: string[];
}

/**
 * `plitzi task spike "…"`, by the agent at work: its task needs something found out before it goes on — and finding out
 * is a lead's (an agent's model is not a lead's). The task is blocked on the lead, saying what, its files and agent its
 * own; the lead finds it out and lifts the block with the answer — a finding of the task's — or, when it changes the
 * work, stacks the tasks it makes (`run extend`).
 */
export const startSpike = async (ctx: RunContext, runId: string, taskId: string, question: string): Promise<Spiked> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'ask for a spike');
  const task = findTask(loaded, taskId);
  const view = await holderOf(ctx, loaded, task);
  if (!isWorked(view.state.status)) {
    throw new RunRefusal('invalid', `Task "${taskId}" is ${view.state.status}: a task at work asks for a spike`, {
      task: taskId
    });
  }

  await updateState(
    view.paths,
    state => ({
      ...state,
      status: 'blocked',
      blockedBy: { reason: `needs a spike: ${question}`, needs: 'lead', spike: question },
      notes: [...state.notes, { at: at(ctx), by: ctx.agent, text: `Needs a spike: ${question}` }]
    }),
    ctx.now
  );
  await sendMessage(ctx, loaded, {
    from: taskId,
    to: LEAD,
    text: `${taskId} needs a spike before it goes on: ${question} — find it out and lift its block with what you found: plitzi task unblock ${taskId} --answer "…" (kept as its finding); if it changes the work, stack the tasks it makes: plitzi run extend <stage.json>`
  });
  await logRun(ctx, loaded.paths, { action: 'spike', task: taskId, question });

  return { task: taskId, status: 'blocked', question };
};

/**
 * `plitzi task spike <task> --done "…" [--tasks <stage.json>]`, by a lead: what a spike found out — research alone,
 * done by it, its findings in the brief of every task that waits for it — and its result: the tasks it makes, stacked on
 * the run as a stage, each with what was found for it (`findings`). The run's scope spike ends this way, and the work
 * flows from it.
 */
export const answerSpike = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  text: string,
  { tasks }: { tasks?: string } = {}
): Promise<Spiked> => {
  requireNoTask(ctx, 'say what a spike found');
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'say what a spike found');
  if (!isCoLead(loaded.record, ctx.agent)) {
    await requireLead(ctx, loaded, 'say what a spike found — a spike is a lead’s');
  }

  const task = findTask(loaded, taskId);
  const view = await viewTask(loaded.paths, task);
  if (view.state.status !== 'spike' || !isResearch(task)) {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}" is ${view.state.status}, not a spike: an agent's task that needs one is blocked on the lead — lift it with what you found (plitzi task unblock ${taskId} --answer "…")`,
      { task: taskId }
    );
  }

  // Its result first: a stage refused leaves the spike open, nothing said done that made nothing.
  const stacked = tasks === undefined ? undefined : await extendRun(ctx, runId, tasks);
  const question = task.spike ?? 'what it needed';
  const finding: Finding = { at: at(ctx), by: ctx.agent, question, text };
  await updateState(
    view.paths,
    state => ({
      ...state,
      status: 'done',
      findings: [...(state.findings ?? []), finding],
      notes: [...state.notes, { at: at(ctx), by: ctx.agent, text: `Found: ${text}` }]
    }),
    ctx.now
  );
  await logRun(ctx, loaded.paths, {
    action: 'spike-done',
    task: taskId,
    question,
    status: 'done',
    ...(stacked ? { added: stacked.added } : {})
  });

  // Said by a lead that reviews, not by the lead: the lead hears what was found.
  if (ctx.agent !== LEAD) {
    await sendMessage(ctx, loaded, {
      from: ctx.agent,
      to: LEAD,
      text: `On ${taskId} (${question}): ${text}`,
      fyi: true,
      about: taskId
    });
  }

  const waited = await readyWhatWaited(ctx, await loadRun(ctx, runId));
  if (waited.length > 0) {
    await logRun(ctx, loaded.paths, { action: 'handed-on', task: taskId, granted: [], ready: waited });
  }

  await sayIfAllDone(ctx, runId);
  const ready = [...(stacked?.ready ?? []), ...waited];

  return {
    task: taskId,
    status: 'done',
    question,
    finding,
    ...(stacked ? { added: stacked.added } : {}),
    ...(ready.length > 0 ? { ready } : {}),
    ...(stacked?.notices ? { notices: stacked.notices } : {})
  };
};
