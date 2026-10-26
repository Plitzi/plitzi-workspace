import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

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
  /**
   * What a scout proposes, waiting for the lead's approval (`task spike --approve`): the tasks it makes, by id — none
   * for findings alone. Nothing is applied until the lead says.
   */
  proposed?: string[];
  /** Approved findings alone (`--approve --findings-only`): the tasks the scout proposed, left out. */
  dropped?: string[];
  /** The tasks it left ready: those it made, and those that waited for it. */
  ready?: string[];
  /** What the check of the tasks it made says and refuses nothing for: a value no check measures, an id not there. */
  notices?: string[];
}

/** The name the primer a proposed stage names is kept under, beside it: the stage reads it from there. */
const PROPOSED_PRIMER = 'proposed-primer.md';

/**
 * `plitzi task spike "…"`, by the agent at work: its task needs something found out before it goes on — the lead's to
 * answer, as every block is (a scout finds out the run's spikes alone, and stops once none is left: Carlos). The task is
 * blocked on it, saying what, its files and agent its own; the lead's answer (`task unblock --answer`) lifts the block,
 * kept as a finding of the task's.
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
      blockedBy: {
        reason: `needs a spike: ${question} — the lead finds it out and lifts the block with it: plitzi task unblock ${taskId} --answer "…" (kept as its finding); work it changes, a stage: plitzi run extend <stage.json>`,
        needs: 'lead',
        spike: question
      },
      notes: [...state.notes, { at: at(ctx), by: ctx.agent, text: `Needs a spike: ${question}` }]
    }),
    ctx.now
  );
  // No message: the block, saying what and how to answer it, wakes the lead — a message beside it was a question
  // `task unblock --answer` never answered, and held the task's approval.
  await logRun(ctx, loaded.paths, { action: 'spike', task: taskId, question });

  return { task: taskId, status: 'blocked', question };
};

/** A spike to find out: a research task of the run's — an agent's question is a block, the lead's to answer. */
const isOpenSpike = (view: TaskView): boolean => view.state.status === 'spike' && isResearch(view.task);

/** What a spike asks. */
const questionOf = (view: TaskView): string => view.task.spike ?? 'what it needed';

/**
 * `plitzi task spike <spike> --done "…" [--tasks <stage.json>]`: what a spike found — and the tasks it makes. A scout's is proposed: every spike is the lead's to approve, what is found mostly becoming the work it manages,
 * and adding tasks the lead's alone (Carlos). The stage is checked whole as `run extend --dry-run` checks it and kept
 * beside the spike, its primer with it. The lead's own research is done at once (an agent's block it lifts with `task unblock --answer`).
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
  const view = await viewTask(loaded.paths, findTask(loaded, taskId));
  const scout = (await scoutsOf(ctx.root)).includes(ctx.agent);
  if (!scout) {
    await requireLead(ctx, 'say what a spike found — a spike is a scout’s, approved by the lead');
  }

  const holder = view.state.spikedBy?.by;
  if (scout && holder !== undefined && holder !== ctx.agent) {
    throw new RunRefusal('claimed', `${holder} finds out ${taskId}: it is theirs to say`, { task: taskId, holder });
  }

  if (!isOpenSpike(view)) {
    throw new RunRefusal(
      'invalid',
      view.state.status === 'blocked' && view.state.blockedBy?.spike !== undefined
        ? scout
          ? `Task "${taskId}" is an agent's question, blocked on the lead: the lead answers it — you find out the run's spikes alone`
          : `Task "${taskId}" is blocked on a question: lift it with what you found — plitzi task unblock ${taskId} --answer "…"`
        : `Task "${taskId}" is ${view.state.status}, not a spike`,
      { task: taskId }
    );
  }

  if (view.state.proposed !== undefined) {
    throw new RunRefusal(
      'invalid',
      `${taskId}'s ${view.state.proposed.tasks.length > 0 ? 'tasks wait' : 'finding waits'} for the lead's approval already (proposed by ${view.state.proposed.by}): ${scout ? 'the lead approves it or sends it back with what it asks' : `approve it — plitzi task spike ${taskId} --approve — or send it back: plitzi task spike ${taskId} --changes "…"`}`,
      { task: taskId }
    );
  }

  return scout
    ? propose(ctx, loaded, view, text, tasks)
    : finishSpike(ctx, runId, loaded, view, { at: at(ctx), by: ctx.agent, text }, tasks);
};

/**
 * The stage a scout proposes, kept beside the spike with the primer it names: the stage reads its primer beside it, so a
 * primer left where the scout wrote it would be lost once the stage moved.
 */
const keepStage = async (view: TaskView, file: string): Promise<void> => {
  const stage: unknown = JSON.parse(await fs.readFile(file, 'utf-8'));
  if (isRecord(stage) && typeof stage.primer === 'string') {
    await fs.copyFile(path.resolve(path.dirname(file), stage.primer), path.join(view.paths.dir, PROPOSED_PRIMER));
    await fs.writeFile(view.paths.proposedStage, `${JSON.stringify({ ...stage, primer: PROPOSED_PRIMER }, null, 2)}\n`);

    return;
  }

  await fs.copyFile(file, view.paths.proposedStage);
};

const dropStage = async (view: TaskView): Promise<void> => {
  await fs.rm(view.paths.proposedStage, { force: true });
  await fs.rm(path.join(view.paths.dir, PROPOSED_PRIMER), { force: true });
};

/** A scout's result, proposed to the lead: checked whole now, so the lead approves what will apply — nothing applied yet. */
const propose = async (
  ctx: RunContext,
  loaded: LoadedRun,
  view: TaskView,
  text: string,
  file: string | undefined
): Promise<Spiked> => {
  const checked = file === undefined ? undefined : await extendRun(ctx, loaded.record.runId, file, { dryRun: true });
  if (file !== undefined) {
    await keepStage(view, file);
  }

  const added = checked?.added ?? [];
  const question = questionOf(view);
  await updateState(
    view.paths,
    state => ({
      ...state,
      proposed: { by: ctx.agent, at: at(ctx), text, tasks: added },
      notes: [
        ...state.notes,
        {
          at: at(ctx),
          by: ctx.agent,
          text: `Found: ${text}${added.length > 0 ? ` — proposes ${added.join(', ')}` : ''}`
        }
      ]
    }),
    ctx.now
  );
  // No message: the proposal itself wakes the lead (run watch's `proposal`), and `task next --role lead` hands it.
  await logRun(ctx, loaded.paths, { action: 'spike-proposed', task: view.task.id, question, proposed: added });
  // What finding it out cost, kept as the scout hands it over: the lead's approval is another piece.
  await logSpent(ctx, loaded, view.task.id, 'spike');

  return {
    task: view.task.id,
    status: view.state.status,
    question,
    proposed: added,
    ...(checked?.checked?.notices.length ? { notices: checked.checked.notices } : {})
  };
};

/**
 * `plitzi task spike <spike> --approve`, the lead's: what a scout proposed, applied — the tasks it makes stacked and the
 * research done.
 */
export const approveSpike = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  /**
   * `findingsOnly`: what it found approved, the tasks it proposes left out — for the backlog, a later run: encore-10's
   * lead had to send a scout's result back and end the spike itself, and the scout read "say it again".
   */
  { findingsOnly = false }: { findingsOnly?: boolean } = {}
): Promise<Spiked> => {
  requireNoTask(ctx, 'approve what a spike proposes');
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'approve what a spike proposes');
  await requireLead(ctx, 'approve what a spike proposes');
  const view = await viewTask(loaded.paths, findTask(loaded, taskId));
  const { proposed } = view.state;
  // Only a spike's proposal: approved on a task no longer one, it would close the task as research done.
  if (proposed === undefined || !isOpenSpike(view)) {
    throw new RunRefusal(
      'invalid',
      `${taskId} proposes nothing to approve: it is ${view.state.status}${isOpenSpike(view) ? ', still being found out' : ''}`,
      { task: taskId }
    );
  }

  const staged = proposed.tasks.length > 0 && !findingsOnly ? view.paths.proposedStage : undefined;
  const done = await finishSpike(
    ctx,
    runId,
    loaded,
    view,
    { at: proposed.at, by: proposed.by, text: proposed.text },
    staged
  );

  return findingsOnly && proposed.tasks.length > 0 ? { ...done, dropped: proposed.tasks } : done;
};

/**
 * `plitzi task spike <spike> --changes "…"`, the lead's: what a scout proposed, sent back with what to change — the spike
 * its scout's again, nothing applied.
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
  await dropStage(view);
  await sendMessage(ctx, loaded, {
    from: LEAD,
    to: agentAddress(proposed.by),
    text: `${taskId}: the lead sends what you found back — ${asked}. Say it again with that: plitzi task spike ${taskId} --done "…"${proposed.tasks.length > 0 ? ' --tasks <stage.json>' : ''}`,
    about: taskId
  });
  await logRun(ctx, loaded.paths, { action: 'spike-sent-back', task: taskId, to: proposed.by });

  return { task: taskId, status: view.state.status, question: questionOf(view) };
};

/** Research done: its tasks stacked (`file`), its finding kept, what waited for it made ready. */
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
  const question = questionOf(view);
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
  await dropStage(view);
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
