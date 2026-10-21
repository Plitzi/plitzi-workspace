import { isCoLead, requireLead } from '../leads';
import { agentAddress, LEAD, sendMessage } from '../messages';
import { dependenciesDone } from '../plan';
import { RunRefusal } from '../refusal';
import { assertStatus, loadRun, logRun, requireNoTask } from '../run';
import { isResearch } from '../spike';
import { updateState, viewTask } from '../taskStore';
import { isWorked } from '../worked';
import { at, findTask, holderOf } from './common';
import { readyWhatWaited, sayIfAllDone, statesOf } from './handOn';

import type { TaskStatus } from '../model';
import type { RunContext } from '../run';
import type { Finding } from '../spike';

export interface Spiked {
  task: string;
  status: TaskStatus;
  /** What it set out to find, or found. */
  question: string;
  finding?: Finding;
  /** The tasks its findings made ready: research alone, done. */
  ready?: string[];
  /** Its agent, told what was found: it goes on building. */
  told?: string;
}

/**
 * `plitzi task spike "…"`, by the agent at work: its task needs something found out before it goes on — a lead's to
 * find, as every spike is (an agent's model is not a lead's). The task waits in spike, its files and its agent its own,
 * and the lead is asked; the findings come back to the agent with its next command.
 */
export const startSpike = async (ctx: RunContext, runId: string, taskId: string, question: string): Promise<Spiked> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'ask for a spike');
  const task = findTask(loaded, taskId);
  const view = await holderOf(ctx, loaded, task);
  if (view.state.status === 'spike') {
    throw new RunRefusal('invalid', `Task "${taskId}" is in spike already: a lead finds it out`, { task: taskId });
  }

  if (!isWorked(view.state.status)) {
    throw new RunRefusal('invalid', `Task "${taskId}" is ${view.state.status}: a task at work goes back to spike`, {
      task: taskId
    });
  }

  const back = view.state.status;
  await updateState(
    view.paths,
    state => ({
      ...state,
      status: 'spike',
      spiking: question,
      notes: [...state.notes, { at: at(ctx), by: ctx.agent, text: `Spike (from ${back}): ${question}` }]
    }),
    ctx.now
  );
  await sendMessage(ctx, loaded, {
    from: taskId,
    to: LEAD,
    text: `${taskId} needs a spike before it goes on: ${question} — find it out and say it: plitzi task spike ${taskId} --done "…"`
  });
  await logRun(ctx, loaded.paths, { action: 'spike', task: taskId, question });

  return { task: taskId, status: 'spike', question };
};

/**
 * `plitzi task spike <task> --done "…"`, by a lead: what it found out, kept with the task — in its brief and in that of
 * every task that waits for it. Research alone is done by it. A task an agent moved back goes on with that agent, told;
 * one no agent holds is ready to be built — or pending, while what it waits for is not done.
 */
export const answerSpike = async (ctx: RunContext, runId: string, taskId: string, text: string): Promise<Spiked> => {
  requireNoTask(ctx, 'say what a spike found');
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'say what a spike found');
  if (!isCoLead(loaded.record, ctx.agent)) {
    await requireLead(ctx, loaded, 'say what a spike found — a spike is a lead’s');
  }

  const task = findTask(loaded, taskId);
  const view = await viewTask(loaded.paths, task);
  if (view.state.status !== 'spike') {
    throw new RunRefusal('invalid', `Task "${taskId}" is ${view.state.status}, not in spike`, { task: taskId });
  }

  const question = view.state.spiking ?? task.spike ?? 'what it needed';
  const finding: Finding = { at: at(ctx), by: ctx.agent, question, text };
  const states = await statesOf(loaded);
  const holder = view.owner?.agent;
  const status: TaskStatus = isResearch(task)
    ? 'done'
    : holder
      ? view.state.round > 0
        ? 'changes-requested'
        : 'in-progress'
      : dependenciesDone(task, states)
        ? 'ready'
        : 'pending';
  await updateState(
    view.paths,
    state => ({
      ...state,
      status,
      spiking: undefined,
      findings: [...(state.findings ?? []), finding],
      notes: [...state.notes, { at: at(ctx), by: ctx.agent, text: `Found: ${text}` }]
    }),
    ctx.now
  );
  await logRun(ctx, loaded.paths, { action: 'spike-done', task: taskId, question, status });
  if (holder) {
    await sendMessage(ctx, loaded, {
      from: LEAD,
      to: agentAddress(holder),
      text: `${taskId}'s spike is answered — ${question}: ${text}. Go on building it.`
    });
  }

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

  const ready = status === 'done' ? await readyWhatWaited(ctx, await loadRun(ctx, runId)) : [];
  if (ready.length > 0) {
    await logRun(ctx, loaded.paths, { action: 'handed-on', task: taskId, granted: [], ready });
  }

  if (status === 'done') {
    await sayIfAllDone(ctx, runId);
  }

  return {
    task: taskId,
    status,
    question,
    finding,
    ...(ready.length > 0 ? { ready } : {}),
    ...(holder ? { told: holder } : {})
  };
};
