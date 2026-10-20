import fs from 'node:fs/promises';

import { writeJson } from '../files';
import { requireLead } from '../leads';
import { AGENT, agentAddress, LEAD, sendMessage } from '../messages';
import { syncPreview } from '../preview';
import { RunRefusal } from '../refusal';
import { assertStatus, loadRun, logRun, readApproved, requireNoTask } from '../run';
import { withLock } from '../store';
import { cutTask, lockedFiles, updateState, viewTask } from '../taskStore';
import { at, findTask } from './common';
import { grantWaiters } from './locks';
import { integrateWhenReady, settleRequests } from './requests';

import type { ApprovedFile } from '../model';
import type { RunContext } from '../run';

/**
 * A task taken back: reassigned — cut, for another to take — or reverted, its work taken out of the run.
 */

/** `plitzi task reassign`: the lead or a person cuts a task — its holder's token revoked — for another to take. */
export const reassignTask = async (
  ctx: RunContext,
  runId: string,
  taskId: string
): Promise<{
  from?: string;
  reviewedRound?: number;
  released: string[];
  granted: string[];
  settled: string[];
  integrations: string[];
}> => {
  requireNoTask(ctx, 'reassign a task');
  const loaded = await loadRun(ctx, runId);
  await requireLead(ctx, loaded, 'reassign a task');
  const task = findTask(loaded, taskId);
  const view = await viewTask(loaded.paths, task);
  if (view.state.status === 'done') {
    throw new RunRefusal('invalid', `Task "${taskId}" is done: revert it instead (plitzi task revert ${taskId})`);
  }

  // What it held by turns is let go with it — handed to whoever waits, its requests merged — not left until its locks
  // run out half an hour after its agent went quiet.
  const turns = [...(await lockedFiles(view.paths))].filter(([, lock]) => lock.kind === 'turn').map(([file]) => file);
  await cutTask(view, `reassigned by ${ctx.agent}`, ctx.now);
  const refreshed = await loadRun(ctx, runId);
  const granted = await grantWaiters(ctx, refreshed, turns);
  const settled = await settleRequests(ctx, refreshed, turns);
  const integrations = await withLock(refreshed.paths.mergeLock, () => integrateWhenReady(ctx, refreshed), {
    now: ctx.now
  });
  await logRun(ctx, loaded.paths, {
    action: 'reassign',
    task: taskId,
    from: view.owner?.agent,
    released: turns,
    granted,
    settled,
    integrations
  });

  return {
    ...(view.owner ? { from: view.owner.agent } : {}),
    ...(view.reviewed ? { reviewedRound: view.reviewed.round } : {}),
    released: turns,
    granted,
    settled,
    integrations
  };
};

/**
 * `plitzi task revert`: what one approved task brought into the run's work taken back out, before the final merge — the
 * others' untouched. A file another task changed after it is not reverted, and is said.
 */
export const revertTask = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  reason?: string
): Promise<{ reverted: string[]; kept: string[]; dependants: string[]; waiting: string[] }> => {
  requireNoTask(ctx, 'revert a task');
  const loaded = await loadRun(ctx, runId);
  await requireLead(ctx, loaded, 'revert a task');
  if (reason === undefined || reason.trim() === '') {
    throw new RunRefusal(
      'invalid',
      'A revert says why — kept in its notes, and said to whoever takes it again: --reason "…"',
      {
        task: taskId
      }
    );
  }

  assertStatus(loaded, ['open', 'stopping', 'stopped'], 'revert a task');
  const task = findTask(loaded, taskId);
  const view = await viewTask(loaded.paths, task);
  if (view.state.status !== 'done') {
    throw new RunRefusal('invalid', `Task "${taskId}" is ${view.state.status}: only an approved task is reverted`);
  }

  const reverted: string[] = [];
  const kept: string[] = [];
  await withLock(
    loaded.paths.mergeLock,
    async () => {
      const approved = await readApproved(loaded.paths);
      const files: Record<string, ApprovedFile> = {};
      for (const [file, entry] of Object.entries(approved.files)) {
        if (entry.task === taskId) {
          if (entry.previous) {
            files[file] = entry.previous;
          }

          reverted.push(file);
          continue;
        }

        let previous = entry.previous;
        while (previous) {
          if (previous.task === taskId) {
            kept.push(file);
            break;
          }

          previous = previous.previous;
        }

        files[file] = entry;
      }

      await writeJson(loaded.paths.approved, { files, tasks: approved.tasks.filter(id => id !== taskId) });
    },
    { now: ctx.now }
  );
  await fs.rm(view.paths.reviewed, { force: true });
  await updateState(
    view.paths,
    state => ({
      ...state,
      status: 'ready',
      round: 0,
      notes: [
        ...state.notes,
        {
          at: at(ctx),
          by: ctx.agent,
          text: `Reverted${reason ? ` — ${reason}` : ''}: ${reverted.join(', ') || 'nothing'}`
        }
      ]
    }),
    ctx.now
  );
  // Whoever takes it again hears why, with its take: what to redo, not only that it is to be redone.
  if (reason) {
    await sendMessage(ctx, loaded, {
      from: LEAD,
      to: taskId,
      text: `This task was reverted and is to be done again: ${reason}`
    });
  }

  // …and the agents who did it hear it by name: their work is out of the run, whoever redoes it.
  const workedBy = [
    ...new Set(view.state.notes.filter(note => note.text.startsWith('Taken')).map(note => note.by))
  ].filter(agent => AGENT.test(agentAddress(agent)));
  for (const agent of workedBy) {
    await sendMessage(ctx, loaded, {
      from: LEAD,
      to: agentAddress(agent),
      text: `Your work on ${taskId} was reverted${reason ? `: ${reason}` : ''} — out of the run; plitzi task next hands it on`
    });
  }

  // What was built on it waits for it again: not started, it goes back to pending; in hand, its agent is told.
  const dependants = loaded.tasks.filter(each => each.dependsOn.includes(taskId));
  const waiting: string[] = [];
  for (const dependant of dependants) {
    const dependantView = await viewTask(loaded.paths, dependant);
    if (dependantView.state.status === 'done') {
      continue;
    }

    const notStarted = !dependantView.owner && dependantView.state.status === 'ready';
    await updateState(
      dependantView.paths,
      state => ({
        ...state,
        ...(notStarted ? { status: 'pending' as const } : {}),
        notes: [
          ...state.notes,
          {
            at: at(ctx),
            by: 'plitzi',
            text: notStarted
              ? `"${taskId}", which it depends on, was reverted: it waits for it again`
              : `"${taskId}", which it depends on, was reverted (${reverted.join(', ') || 'nothing'}): what it builds on is not in the run any more`
          }
        ]
      }),
      ctx.now
    );
    if (notStarted) {
      waiting.push(dependant.id);
    }
  }

  await syncPreview(await loadRun(ctx, runId), ctx.root);
  await logRun(ctx, loaded.paths, { action: 'revert', task: taskId, reverted, kept, waiting });

  return { reverted, kept, dependants: dependants.map(each => each.id), waiting };
};
