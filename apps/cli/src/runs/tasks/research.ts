import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { closeApproved } from './closeApproved';
import { at, findTask, holderOf } from './common';
import { readyWhatWaited, sayIfAllDone } from './handOn';
import { reviewAtComplete } from './reviews';
import { isPrincipal, requireLead } from '../agents/leads';
import { RunRefusal } from '../core/refusal';
import { updateState, viewTask } from '../core/taskStore';
import { extendRun, seeStage } from '../plan/extend';
import { uncheckedOf } from '../plan/plan';
import { isResearch } from '../plan/spike';
import { logSpent } from '../report/spent';
import { assertStatus, loadRun, logRun, readPlanFile } from '../run';

import type { ReviewedTask } from './review';
import type { TaskStatus } from '../core/model';
import type { TaskView } from '../core/taskStore';
import type { Extended } from '../plan/extend';
import type { Finding } from '../plan/spike';
import type { LoadedRun, RunContext } from '../run';

/**
 * A research card's two moves of its own: its result said at `complete` (`--found`, the tasks it makes with `--tasks`),
 * and the lead's approval stacking those tasks (`--leave` what it leaves out). It is taken, held, sent back and reviewed as
 * any card; every result is the lead's to approve, and adding tasks the lead's alone (Carlos).
 */

export interface Researched {
  task: string;
  status: TaskStatus;
  /** What it set out to find. */
  question: string;
  /** What it found, once approved — or said by the lead, done at once. */
  finding?: Finding;
  /** In review with the lead: the tasks it makes, by id — none for findings alone. Nothing is stacked until approved. */
  proposed?: string[];
  /** The tasks it made, stacked on the run. */
  added?: string[];
  /** The tasks it left ready: those it made, and those that waited for it. */
  ready?: string[];
  /** What the check of the tasks it makes says and refuses nothing for: a value no check measures, an id not there. */
  notices?: string[];
  /** The stage it stacked, kept in the run's inputs: the plan its tasks are amended from (`plitzi run amend`). */
  stage?: string;
}

/** The name the primer a proposed stage names is kept under, beside it: the stage reads it from there. */
const PROPOSED_PRIMER = 'proposed-primer.md';

const questionOf = (view: TaskView): string => view.task.spike ?? 'what it needed';

/**
 * The stage a scout proposes, kept beside the card with the primer it names: the stage reads its primer beside it, so a
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

/**
 * The stage a scout proposed, stacked: kept with its primer in the run's inputs, under the card — the plan its tasks are
 * amended from. Dropped with the proposal, a run's lead rebuilt it from the tasks and was refused, their files and
 * quality the run's.
 */
const keepStacked = async (loaded: LoadedRun, view: TaskView): Promise<string> => {
  const into = path.join(loaded.paths.dir, 'inputs', view.task.id);
  await fs.mkdir(into, { recursive: true });
  const kept = path.join(into, 'stage.json');
  await fs.copyFile(view.paths.proposedStage, kept);
  await fs
    .copyFile(path.join(view.paths.dir, PROPOSED_PRIMER), path.join(into, PROPOSED_PRIMER))
    .catch((error: unknown) => {
      if (!(isRecord(error) && error.code === 'ENOENT')) {
        throw error;
      }
    });

  return kept;
};

/** What a research card proposed, dropped: sent back, or stacked. */
export const dropProposal = async (ctx: RunContext, view: TaskView): Promise<void> => {
  await fs.rm(view.paths.proposedStage, { force: true });
  await fs.rm(path.join(view.paths.dir, PROPOSED_PRIMER), { force: true });
  await updateState(view.paths, state => ({ ...state, proposed: undefined }), ctx.now);
};

/**
 * `plitzi task complete --found "…" [--tasks <stage.json>]`: what a research card found. Its scout's goes to review with
 * the lead — the stage checked whole as `run extend --dry-run` checks it, and kept beside the card — and the lead's own
 * (one nobody holds, a team with no scout) is done at once: nobody reviews the lead's word.
 */
export const completeResearch = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  text: string,
  { tasks }: { tasks?: string } = {}
): Promise<Researched> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'complete a task');
  const task = findTask(loaded, taskId);
  if (!isResearch(task)) {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}" is no research card: what one found is said with plitzi task complete --found — complete this one without it`,
      { task: taskId }
    );
  }

  if (ctx.token === undefined && isPrincipal(ctx.agent)) {
    return findOutAsLead(ctx, loaded, await viewTask(loaded.paths, task), text, tasks);
  }

  const view = await holderOf(ctx, loaded, task);
  if (!['in-progress', 'changes-requested'].includes(view.state.status)) {
    throw new RunRefusal('invalid', `Task "${taskId}" is ${view.state.status}: only a card at work completes`, {
      task: taskId
    });
  }

  // The tasks a scout proposes come with lines a command proves: a run's scope came without, the dry run said so,
  // and the lead sent it back for them — a round of the run's costliest card.
  if (tasks !== undefined) {
    const unchecked = uncheckedOf(
      (await readPlanFile(tasks, { runId: `${runId}-proposed`, goal: loaded.plan.goal })).tasks
    );
    if (unchecked.length > 0) {
      throw new RunRefusal(
        'invalid',
        `${unchecked.map(each => each.id).join(', ')} ${unchecked.length === 1 ? 'has' : 'have'} no acceptance line a command proves: give each { said, check } — a page check, a measure, a spec — run once on the run's work (plitzi run extend <stage> --dry-run --lines says what each is), then complete again`,
        { task: taskId }
      );
    }
  }

  // Seen before the lead stacks it, as the lead's dry run sees it: stacking it is the lead's.
  const checked = tasks === undefined ? undefined : await seeStage(ctx, runId, tasks);
  if (tasks !== undefined) {
    await keepStage(view, tasks);
  }

  const proposed = checked?.added ?? [];
  await updateState(
    view.paths,
    state => ({
      ...state,
      status: 'in-review',
      review: reviewAtComplete(state, at(ctx)),
      proposed: { by: ctx.agent, at: at(ctx), text, tasks: proposed },
      notes: [
        ...state.notes,
        {
          at: at(ctx),
          by: ctx.agent,
          text: `Found: ${text}${proposed.length > 0 ? ` — proposes ${proposed.join(', ')}` : ''}`
        }
      ]
    }),
    ctx.now
  );
  // A complete as any card's — what it found said with it: the run's flow, the feed and a fresh context read it as one.
  await logRun(ctx, loaded.paths, { action: 'complete', task: taskId, question: questionOf(view), proposed });
  // What finding it out cost, kept as its scout hands it over: the lead's review is another piece.
  await logSpent(ctx, loaded, taskId, 'spike');

  return {
    task: taskId,
    status: 'in-review',
    question: questionOf(view),
    proposed,
    ...(checked?.checked?.notices.length ? { notices: checked.checked.notices } : {})
  };
};

/** The lead's own research, nobody else at it: its tasks stacked and the card done, as the lead's approval leaves it. */
const findOutAsLead = async (
  ctx: RunContext,
  loaded: LoadedRun,
  view: TaskView,
  text: string,
  tasks: string | undefined
): Promise<Researched> => {
  await requireLead(ctx, 'say what a research card found');
  if (view.owner !== undefined) {
    throw new RunRefusal(
      'claimed',
      `${view.owner.agent} finds out ${view.task.id}: what it finds comes to your review — plitzi task next`,
      { task: view.task.id, holder: view.owner.agent }
    );
  }

  if (view.state.status !== 'ready') {
    throw new RunRefusal('invalid', `Task "${view.task.id}" is ${view.state.status}: only a ready one is found out`, {
      task: view.task.id
    });
  }

  const done = await stackFound(ctx, loaded, view, { at: at(ctx), by: ctx.agent, text }, tasks);
  await logSpent(ctx, loaded, view.task.id, 'spike');
  const waited = await readyWhatWaited(ctx, await loadRun(ctx, loaded.record.runId));
  if (waited.length > 0) {
    await logRun(ctx, loaded.paths, { action: 'handed-on', task: view.task.id, granted: [], ready: waited });
  }

  await sayIfAllDone(ctx, loaded.record.runId);
  const ready = [...(done.ready ?? []), ...waited];

  return { ...done, ...(ready.length > 0 ? { ready } : {}) };
};

/**
 * `task check --tasks <stage.json>` at a research card: the stage it would propose seen as the lead would stack it —
 * every check, each line run once on the run's work — nothing proposed, nothing stacked. A scout's way to see its stage:
 * A run's and a run's reached for `run extend`, the lead's.
 */
export const seeProposal = async (ctx: RunContext, runId: string, taskId: string, file: string): Promise<Extended> => {
  const loaded = await loadRun(ctx, runId);
  const task = findTask(loaded, taskId);
  if (!isResearch(task)) {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}" is no research card: plitzi task check --tasks sees the stage a research card proposes — plitzi task check alone checks this one`,
      { task: taskId }
    );
  }

  await holderOf(ctx, loaded, task);

  return seeStage(ctx, runId, file, { lines: true });
};

/**
 * What a research card proposed, approved by the lead: the tasks it makes stacked — but those `leave` names (`all`: every
 * one, its findings kept alone) — and the card closed as any approval closes one. A `-tests` card left out is its card
 * asking for no tests (`"tests": false`); a task kept that waits for one left out is refused, naming both.
 */
export const approveResearch = async (
  ctx: RunContext,
  loaded: LoadedRun,
  view: TaskView,
  leave: readonly string[] | 'all' = []
): Promise<ReviewedTask> => {
  const { proposed } = view.state;
  if (proposed === undefined) {
    throw new RunRefusal('invalid', `${view.task.id} proposes nothing: it is ${view.state.status}`, {
      task: view.task.id
    });
  }

  const stage =
    proposed.tasks.length === 0 || leave === 'all' ? undefined : await leaveOut(view, proposed.tasks, leave);
  const found = await stackFound(ctx, loaded, view, { at: proposed.at, by: proposed.by, text: proposed.text }, stage);
  const closed = await closeApproved(
    ctx,
    await loadRun(ctx, loaded.record.runId),
    await viewTask(loaded.paths, view.task),
    {
      round: view.state.round,
      merged: [],
      fulfilled: [],
      notReviewed: []
    }
  );

  return {
    ...closed,
    ready: [...new Set([...(found.ready ?? []), ...(closed.ready ?? [])])],
    found: {
      added: found.added ?? [],
      left: leave === 'all' ? proposed.tasks : leave.filter(id => proposed.tasks.includes(id)),
      ...(found.notices ? { notices: found.notices } : {}),
      ...(found.stage === undefined ? {} : { stage: found.stage })
    }
  };
};

/** The proposed stage without what the lead leaves out, written over it: what is stacked is what was approved. */
const leaveOut = async (view: TaskView, proposed: readonly string[], leave: readonly string[]): Promise<string> => {
  const unknown = leave.filter(id => !proposed.includes(id));
  if (unknown.length > 0) {
    throw new RunRefusal(
      'invalid',
      `${view.task.id} proposes no ${unknown.join(', ')}: plitzi task review ${view.task.id} --approve --leave takes what it proposes — ${proposed.join(', ')} — or all`,
      { task: view.task.id }
    );
  }

  if (leave.length === 0) {
    return view.paths.proposedStage;
  }

  const stage: unknown = JSON.parse(await fs.readFile(view.paths.proposedStage, 'utf-8'));
  if (!isRecord(stage) || !Array.isArray(stage.tasks)) {
    throw new RunRefusal('invalid', `${view.paths.proposedStage} holds no stage: it was changed outside the CLI`);
  }

  const tasks = stage.tasks.filter(isRecord);
  const left = new Set(leave);
  // A task of tests the CLI derives (`<id>-tests`) is not in the stage: left out, its card asks for none.
  const untested = new Set(leave.flatMap(id => (id.endsWith('-tests') ? [id.slice(0, -'-tests'.length)] : [])));
  const kept = tasks
    .filter(task => typeof task.id !== 'string' || !left.has(task.id))
    .map(task => (typeof task.id === 'string' && untested.has(task.id) ? { ...task, tests: false } : task));
  const waiting = kept.flatMap(task =>
    Array.isArray(task.dependsOn) && typeof task.id === 'string'
      ? task.dependsOn
          .filter(id => typeof id === 'string' && left.has(id))
          .map(id => `${String(task.id)} waits for ${String(id)}`)
      : []
  );
  if (waiting.length > 0) {
    throw new RunRefusal(
      'invalid',
      `What is kept waits for what is left out: ${waiting.join(', ')} — leave those too, or keep what they wait for`,
      { task: view.task.id }
    );
  }

  await fs.writeFile(view.paths.proposedStage, `${JSON.stringify({ ...stage, tasks: kept }, null, 2)}\n`);

  return view.paths.proposedStage;
};

/** Research done: its tasks stacked (`file`), its finding kept with the card, what it proposed dropped. */
const stackFound = async (
  ctx: RunContext,
  loaded: LoadedRun,
  view: TaskView,
  finding: Omit<Finding, 'question'>,
  file: string | undefined
): Promise<Researched> => {
  const taskId = view.task.id;
  // Its result first: a stage refused leaves the card as it was, nothing said done that made nothing.
  const stacked = file === undefined ? undefined : await extendRun(ctx, loaded.record.runId, file);
  // Where the plan of its tasks is now: a proposal kept apart, moved into the inputs by the stack, or where the lead
  // wrote it.
  const stage =
    stacked === undefined || file === undefined
      ? undefined
      : file === view.paths.proposedStage
        ? await keepStacked(loaded, view)
        : (stacked.inputs?.find(each => path.basename(each) === path.basename(file)) ?? file);
  const question = questionOf(view);
  const found: Finding = { ...finding, question };
  await updateState(
    view.paths,
    state => ({
      ...state,
      status: 'done',
      findings: [...(state.findings ?? []), found],
      notes: [...state.notes, { at: at(ctx), by: ctx.agent, text: `Found: ${found.text}` }]
    }),
    ctx.now
  );
  await dropProposal(ctx, view);
  await logRun(ctx, loaded.paths, {
    action: 'spike-done',
    task: taskId,
    question,
    status: 'done',
    ...(stacked ? { added: stacked.added } : {})
  });

  return {
    task: taskId,
    status: 'done',
    question,
    finding: found,
    ...(stacked ? { added: stacked.added } : {}),
    ...(stacked && stacked.ready.length > 0 ? { ready: stacked.ready } : {}),
    ...(stacked?.notices ? { notices: stacked.notices } : {}),
    ...(stage === undefined ? {} : { stage })
  };
};
