import fs from 'node:fs/promises';

import { extendRun } from '../extend';
import { requireLead, scoutsOf } from '../leads';
import { agentAddress, LEAD, sendMessage } from '../messages';
import { RunRefusal } from '../refusal';
import { assertStatus, loadRun, logRun, requireNoTask } from '../run';
import { logSpent } from '../spent';
import { isResearch } from '../spike';
import { updateState, viewTask } from '../taskStore';
import { isWorked } from '../worked';
import { at, findTask, holderOf } from './common';
import { readyWhatWaited, sayIfAllDone } from './handOn';

import type { TaskStatus } from '../model';
import type { LoadedRun, RunContext } from '../run';
import type { Finding } from '../spike';
import type { TaskView } from '../taskStore';

export interface Spiked {
  task: string;
  status: TaskStatus;
  /** What it set out to find, or found. */
  question: string;
  finding?: Finding;
  /** The tasks it made — its result, stacked on the run — by id. */
  added?: string[];
  /** The tasks it proposes, by id: waiting for the lead's approval (`task spike --approve`), nothing stacked yet. */
  proposed?: string[];
  /** The tasks it left ready: those it made, and those that waited for it. */
  ready?: string[];
  /** What the check of the tasks it made says and refuses nothing for: a value no check measures, an id not there. */
  notices?: string[];
}

/**
 * `plitzi task spike "…"`, by the agent at work: its task needs something found out before it goes on — and finding out
 * is a scout's (or, with none in the team, the lead's). The task is blocked on it, saying what, its files and agent its
 * own; whoever finds it out lifts the block with the answer — a finding of the task's — and, when it changes the work,
 * the lead stacks the tasks it makes (`run extend`).
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
  const scouts = await scoutsOf(ctx.root);
  await sendMessage(ctx, loaded, {
    from: taskId,
    to: LEAD,
    text:
      scouts.length > 0
        ? `${taskId} needs a spike before it goes on: ${question} — a scout (${scouts.join(', ')}) finds it out and lifts its block; you hear what it found`
        : `${taskId} needs a spike before it goes on: ${question} — find it out and lift its block with what you found: plitzi task unblock ${taskId} --answer "…" (kept as its finding); if it changes the work, stack the tasks it makes: plitzi run extend <stage.json>`,
    ...(scouts.length > 0 ? { fyi: true } : {})
  });
  await logRun(ctx, loaded.paths, { action: 'spike', task: taskId, question });

  return { task: taskId, status: 'blocked', question };
};

/**
 * Who finds a spike out: the scout that took it, or the lead — refused to anyone else, and to a scout another holds.
 */
const assertFindsOut = async (ctx: RunContext, view: TaskView): Promise<'scout' | 'lead'> => {
  if ((await scoutsOf(ctx.root)).includes(ctx.agent)) {
    const holder = view.state.spikedBy?.by;
    if (holder !== undefined && holder !== ctx.agent) {
      throw new RunRefusal('claimed', `${holder} finds out ${view.task.id}: it is theirs to say`, {
        task: view.task.id,
        holder
      });
    }

    return 'scout';
  }

  await requireLead(ctx, 'say what a spike found — a spike is a scout’s, or the lead’s');

  return 'lead';
};

/**
 * `plitzi task spike <task> --done "…" [--tasks <stage.json>]`: what a spike found out — research alone, its findings in
 * the brief of every task that waits for it — and its result, the tasks it makes. A scout's tasks are proposed: checked
 * as `run extend --dry-run` checks them, kept beside the spike, and stacked once the lead approves them — the lead
 * decides the work with the person (Carlos). The lead's own are stacked at once. The run's scope spike ends this way,
 * and the work flows from it.
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
  const task = findTask(loaded, taskId);
  const view = await viewTask(loaded.paths, task);
  const who = await assertFindsOut(ctx, view);
  if (view.state.status !== 'spike' || !isResearch(task)) {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}" is ${view.state.status}, not a spike: an agent's task that needs one is blocked on it — lift it with what you found (plitzi task unblock ${taskId} --answer "…")`,
      { task: taskId }
    );
  }

  if (view.state.proposed !== undefined) {
    throw new RunRefusal(
      'invalid',
      `${taskId}'s tasks wait for the lead's approval already (proposed by ${view.state.proposed.by}): ${who === 'lead' ? `approve them — plitzi task spike ${taskId} --approve — or send them back: plitzi task spike ${taskId} --changes "…"` : 'the lead approves them or sends them back with what it asks'}`,
      { task: taskId }
    );
  }

  if (who === 'scout' && tasks !== undefined) {
    return proposeStage(ctx, loaded, view, text, tasks);
  }

  return finishSpike(ctx, runId, loaded, view, { at: at(ctx), by: ctx.agent, text }, tasks);
};

/** A scout's stage, proposed: checked whole now, so the lead approves what will stack — nothing stacked until it does. */
const proposeStage = async (
  ctx: RunContext,
  loaded: LoadedRun,
  view: TaskView,
  text: string,
  file: string
): Promise<Spiked> => {
  const checked = await extendRun(ctx, loaded.record.runId, file, { dryRun: true });
  await fs.copyFile(file, view.paths.proposedStage);
  const question = view.task.spike ?? 'what it needed';
  await updateState(
    view.paths,
    state => ({
      ...state,
      proposed: { by: ctx.agent, at: at(ctx), text, tasks: checked.added },
      notes: [
        ...state.notes,
        { at: at(ctx), by: ctx.agent, text: `Found: ${text} — proposes ${checked.added.join(', ')}` }
      ]
    }),
    ctx.now
  );
  await sendMessage(ctx, loaded, {
    from: ctx.agent,
    to: LEAD,
    text: `${view.task.id} (${question}): ${text} — proposes ${String(checked.added.length)} task(s): ${checked.added.join(', ')}. Decide with the person, then approve them — plitzi task spike ${view.task.id} --approve — or send them back with what to change: plitzi task spike ${view.task.id} --changes "…" (plitzi task show ${view.task.id} reads them)`,
    about: view.task.id
  });
  await logRun(ctx, loaded.paths, {
    action: 'spike-proposed',
    task: view.task.id,
    question,
    proposed: checked.added
  });
  // What finding it out cost, kept as the scout hands it over: the lead's approval is another piece.
  await logSpent(ctx, loaded, view.task.id, 'spike');

  return {
    task: view.task.id,
    status: 'spike',
    question,
    proposed: checked.added,
    ...(checked.checked?.notices.length ? { notices: checked.checked.notices } : {})
  };
};

/**
 * `plitzi task spike <task> --approve`, the lead's: the tasks a scout proposed, stacked on the run as a stage — the
 * spike done with what the scout found.
 */
export const approveSpike = async (ctx: RunContext, runId: string, taskId: string): Promise<Spiked> => {
  requireNoTask(ctx, 'approve what a spike proposes');
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'approve what a spike proposes');
  await requireLead(ctx, 'approve what a spike proposes');
  const view = await viewTask(loaded.paths, findTask(loaded, taskId));
  const { proposed } = view.state;
  if (proposed === undefined) {
    throw new RunRefusal(
      'invalid',
      `${taskId} proposes nothing to approve: it is ${view.state.status}${view.state.status === 'spike' ? ', still being found out' : ''}`,
      { task: taskId }
    );
  }

  return finishSpike(
    ctx,
    runId,
    loaded,
    view,
    { at: proposed.at, by: proposed.by, text: proposed.text },
    view.paths.proposedStage
  );
};

/**
 * `plitzi task spike <task> --changes "…"`, the lead's: the tasks a scout proposed, sent back with what to change —
 * the spike its scout's again, nothing stacked.
 */
export const reworkSpike = async (ctx: RunContext, runId: string, taskId: string, asked: string): Promise<Spiked> => {
  requireNoTask(ctx, 'send a spike back');
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'send a spike back');
  await requireLead(ctx, 'send a spike back');
  const view = await viewTask(loaded.paths, findTask(loaded, taskId));
  const { proposed } = view.state;
  if (proposed === undefined) {
    throw new RunRefusal('invalid', `${taskId} proposes nothing to send back: it is ${view.state.status}`, {
      task: taskId
    });
  }

  await updateState(
    view.paths,
    state => ({
      ...state,
      proposed: undefined,
      notes: [...state.notes, { at: at(ctx), by: ctx.agent, text: `Sent back: ${asked}` }]
    }),
    ctx.now
  );
  await fs.rm(view.paths.proposedStage, { force: true });
  await sendMessage(ctx, loaded, {
    from: LEAD,
    to: agentAddress(proposed.by),
    text: `${taskId}: the lead sends your tasks back — ${asked}. Propose them again with it: plitzi task spike ${taskId} --done "…" --tasks <stage.json>`,
    about: taskId
  });
  await logRun(ctx, loaded.paths, { action: 'spike-sent-back', task: taskId, to: proposed.by });

  return { task: taskId, status: 'spike', question: view.task.spike ?? 'what it needed' };
};

/** A spike done: its tasks stacked (`file`), its finding kept, what waited for it made ready. */
const finishSpike = async (
  ctx: RunContext,
  runId: string,
  loaded: LoadedRun,
  view: TaskView,
  finding: Omit<Finding, 'question'>,
  file: string | undefined
): Promise<Spiked> => {
  const taskId = view.task.id;
  // Its result first: a stage refused leaves the spike open, nothing said done that made nothing.
  const stacked = file === undefined ? undefined : await extendRun(ctx, runId, file);
  const question = view.task.spike ?? 'what it needed';
  const found: Finding = { ...finding, question };
  await updateState(
    view.paths,
    state => ({
      ...state,
      status: 'done',
      proposed: undefined,
      findings: [...(state.findings ?? []), found],
      notes: [...state.notes, { at: at(ctx), by: ctx.agent, text: `Found: ${found.text}` }]
    }),
    ctx.now
  );
  await fs.rm(view.paths.proposedStage, { force: true });
  await logRun(ctx, loaded.paths, {
    action: 'spike-done',
    task: taskId,
    question,
    status: 'done',
    ...(stacked ? { added: stacked.added } : {})
  });
  // What finding it out cost, kept as the spike ends — a run's scope, every page swept, was counted in its lead's first
  // review after it, $3.77 of a review that took five minutes. A scout's was kept when it proposed.
  if (finding.by === ctx.agent) {
    await logSpent(ctx, loaded, taskId, 'spike');
  }

  // Said by a scout, not by the lead: the lead hears what was found.
  if (ctx.agent !== LEAD) {
    await sendMessage(ctx, loaded, {
      from: ctx.agent,
      to: LEAD,
      text: `On ${taskId} (${question}): ${found.text}`,
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
    finding: found,
    ...(stacked ? { added: stacked.added } : {}),
    ...(ready.length > 0 ? { ready } : {}),
    ...(stacked?.notices ? { notices: stacked.notices } : {})
  };
};
