import fs from 'node:fs/promises';

import { LEAD, sendMessage } from '../messages';
import { dependenciesDone } from '../plan';
import { RunRefusal } from '../refusal';
import { assertStatus, loadRun, logRun } from '../run';
import { isResearch } from '../spike';
import { revokeOwner, updateState } from '../taskStore';
import { isWorked } from '../worked';
import { at, findTask, holderOf } from './common';
import { readyWhatWaited, sayIfAllDone, statesOf } from './handOn';
import { allLocks } from './locks';
import { holdFiles } from './take';

import type { TaskStatus } from '../model';
import type { RunContext } from '../run';
import type { Finding } from '../spike';

export interface Spiked {
  task: string;
  status: TaskStatus;
  /** What it set out to find, or found. */
  question: string;
  finding?: Finding;
  /** Found out, and not built by its agent now — the files another task holds, or what it waits for. */
  released?: { reason: string };
  /** The tasks its findings made ready: research alone, done. */
  ready?: string[];
}

/**
 * `plitzi task spike "…"`: the task at work goes back to finding something out — its agent on it, its files still
 * its own. The activity and the monitor say what it is finding out, and it owes the same signs of life.
 */
export const startSpike = async (ctx: RunContext, runId: string, taskId: string, question: string): Promise<Spiked> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'find something out');
  const task = findTask(loaded, taskId);
  const view = await holderOf(ctx, loaded, task);
  if (view.state.status === 'spike') {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}" is in spike already: say what you found (plitzi task spike --done "…")`,
      { task: taskId }
    );
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
  await logRun(ctx, loaded.paths, { action: 'spike', task: taskId, question });

  return { task: taskId, status: 'spike', question };
};

/**
 * `plitzi task spike --done "…"`: what its agent found, kept with the task — in its brief and in that of every task
 * that waits for it. Research alone is done by it, and the lead told. A task that builds goes on to be built by the
 * same agent, its files held now; one whose dependencies are not done, or whose files another task holds, waits with
 * its findings, its agent free for another.
 */
export const answerSpike = async (ctx: RunContext, runId: string, taskId: string, text: string): Promise<Spiked> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'say what a spike found');
  const task = findTask(loaded, taskId);
  const view = await holderOf(ctx, loaded, task);
  if (view.state.status !== 'spike') {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}" is ${view.state.status}, not in spike: to find something out first, plitzi task spike "what"`,
      { task: taskId }
    );
  }

  const question = view.state.spiking ?? task.spike ?? 'what it needed';
  const finding: Finding = { at: at(ctx), by: ctx.agent, question, text };
  const keep = (status: TaskStatus, said: string) =>
    updateState(
      view.paths,
      state => ({
        ...state,
        status,
        spiking: undefined,
        findings: [...(state.findings ?? []), finding],
        notes: [...state.notes, { at: at(ctx), by: ctx.agent, text: said }]
      }),
      ctx.now
    );
  const logged = (status: TaskStatus) =>
    logRun(ctx, loaded.paths, { action: 'spike-done', task: taskId, question, status });

  if (isResearch(task)) {
    await keep('done', `Found: ${text}`);
    await sendMessage(ctx, loaded, {
      from: ctx.agent,
      to: LEAD,
      text: `On ${taskId} (${question}): ${text}`,
      fyi: true,
      about: taskId
    });
    await logged('done');
    const ready = await readyWhatWaited(ctx, await loadRun(ctx, runId));
    if (ready.length > 0) {
      await logRun(ctx, loaded.paths, { action: 'handed-on', task: taskId, granted: [], ready });
    }

    await sayIfAllDone(ctx, runId);

    return { task: taskId, status: 'done', question, finding, ready };
  }

  // Back from a spike it was moved to, its files are its own still; one that began in spike holds them now.
  const states = await statesOf(loaded);
  const held = await fs.readdir(view.paths.locks).then(
    files => files.length > 0,
    () => false
  );
  const locks = await allLocks(ctx);
  const taken = task.files.flatMap(file => {
    const other = (locks.get(file) ?? []).find(each => each.live && !(each.run === runId && each.task === taskId));

    return other ? [`${file} (${other.task}'s)`] : [];
  });
  const waitsFor = task.dependsOn.filter(id => states.get(id)?.status !== 'done');
  if (held || (waitsFor.length === 0 && taken.length === 0)) {
    if (!held) {
      await holdFiles(ctx, runId, view, task);
    }

    const status: TaskStatus = view.state.round > 0 ? 'changes-requested' : 'in-progress';
    await keep(status, `Found: ${text}`);
    await logged(status);

    return { task: taskId, status, question, finding };
  }

  // Found out, not to be built now: the findings stay with the task, the agent goes to another.
  const reason =
    waitsFor.length > 0 ? `it waits for ${waitsFor.join(', ')}` : `its files are another task's: ${taken.join(', ')}`;
  await revokeOwner(view.paths);
  const status: TaskStatus = dependenciesDone(task, states) ? 'ready' : 'pending';
  await keep(status, `Found: ${text} — not built now: ${reason}; whoever takes it reads this`);
  await logged(status);

  return { task: taskId, status, question, finding, released: { reason } };
};
