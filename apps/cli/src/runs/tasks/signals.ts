import { writeJson } from '../files';
import { requireLead } from '../leads';
import { longFilesIn } from '../longFiles';
import { LEAD, sendMessage, unreadForHolder } from '../messages';
import { RunRefusal } from '../refusal';
import { loadRun, logRun, requireNoTask } from '../run';
import { tellLeftInTmp } from '../strays';
import { DEFAULTS, noSignalAfter, updateState, viewTask } from '../taskStore';
import { at, findTask, holderOf, holderOrCoordinator, refreshCopy } from './common';

import type { LongFile } from '../longFiles';
import type { Message } from '../messages';
import type { Needs, TaskState } from '../model';
import type { RunContext } from '../run';

/**
 * What a task at work says while it works: its progress (the heartbeat), a block and its answer, a note.
 */

/** `plitzi task progress` and `plitzi task heartbeat`: the holder's sign of life, with where it is if it says. */
export interface Signal {
  task: string;
  at: string;
  /** The run is stopping or stopped: said with every sign of life, so the agent knows before a refusal tells it. */
  run?: { status: string; reason?: string };
  /** In review: nothing to keep alive — no one reassigns a task under review, and nothing written now is reviewed. */
  inReview?: true;
  /** Without another sign of life by then, the lead may reassign it. */
  quietAfter: string;
  /** …and by then another agent may take it. */
  takenAfter: string;
  /** What the lead said to it and it had not read: handed over with every sign of life. */
  messages: Message[];
  /** The files of its copy it is making too long to read whole: split before `complete`, which holds the line. */
  longFiles: LongFile[];
}

export const reportProgress = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  progress: { fraction?: number; step?: string }
): Promise<Signal> => {
  const loaded = await loadRun(ctx, runId);
  const task = findTask(loaded, taskId);
  const view = await holderOf(ctx, loaded, task);
  await tellLeftInTmp(ctx, loaded);
  if (progress.fraction !== undefined && (progress.fraction < 0 || progress.fraction > 1)) {
    throw new RunRefusal('invalid', 'A fraction is between 0 and 1: 0.6 is 60 %');
  }

  await writeJson(view.paths.progress, {
    ...(view.progress ?? {}),
    ...progress,
    heartbeatAt: at(ctx)
  });
  const now = ctx.now().getTime();

  return {
    task: taskId,
    at: at(ctx),
    ...(view.state.status === 'in-review' ? { inReview: true as const } : {}),
    ...(loaded.record.status === 'open'
      ? {}
      : {
          run: {
            status: loaded.record.status,
            ...(loaded.record.stopReason ? { reason: loaded.record.stopReason } : {})
          }
        }),
    quietAfter: new Date(now + noSignalAfter(task)).toISOString(),
    takenAfter: new Date(now + noSignalAfter(task) + DEFAULTS.lockAfterSignalMs).toISOString(),
    messages: await unreadForHolder(loaded, taskId, ctx.agent, true),
    longFiles: await longFilesIn(view.paths.work, ctx.root)
  };
};

/** `plitzi task block`: something outside the plan stops it — said, never waited on silently. */
export const blockTask = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  reason: string,
  needs: Needs
): Promise<void> => {
  const loaded = await loadRun(ctx, runId);
  const task = findTask(loaded, taskId);
  const view = await holderOrCoordinator(ctx, loaded, task);
  await updateState(
    view.paths,
    state => ({
      ...state,
      status: 'blocked',
      blockedBy: { reason, needs },
      notes: [...state.notes, { at: at(ctx), by: ctx.agent, text: `Blocked (${needs}): ${reason}` }]
    }),
    ctx.now
  );
  await logRun(ctx, loaded.paths, { action: 'block', task: taskId, needs, reason });
};

/**
 * `plitzi task unblock`: a block lifted — with `answer`, what it was waiting for, said to the task (it reaches its agent
 * with its next command) and kept in its notes. Its holder hears it from `task next`; with nobody on it, it is ready.
 */
export const unblockTask = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  answer?: string
): Promise<TaskState> => {
  requireNoTask(ctx, 'unblock a task');
  const loaded = await loadRun(ctx, runId);
  await requireLead(ctx, loaded, 'unblock a task');
  const task = findTask(loaded, taskId);
  const view = await viewTask(loaded.paths, task);
  if (view.state.status !== 'blocked') {
    throw new RunRefusal('invalid', `Task "${taskId}" is not blocked, it is ${view.state.status}`, { task: taskId });
  }

  const spike = view.state.blockedBy?.spike;
  if (spike !== undefined && answer === undefined) {
    throw new RunRefusal(
      'invalid',
      `${taskId} needs a spike — ${spike}: lift it with what you found — plitzi task unblock ${taskId} --answer "…" — kept as its finding`,
      { task: taskId }
    );
  }

  const said =
    answer === undefined ? undefined : await sendMessage(ctx, loaded, { from: LEAD, to: taskId, text: answer });
  await logRun(ctx, loaded.paths, {
    action: 'unblock',
    task: taskId,
    needed: view.state.blockedBy?.needs,
    ...(said ? { message: said.id } : {})
  });

  // A block can last: what the run approved meanwhile comes into the copy now, not only at its complete.
  const brought = view.owner ? await refreshCopy(ctx, loaded, view) : [];

  return updateState(
    view.paths,
    state => ({
      ...state,
      status: view.owner ? (state.round > 0 ? 'changes-requested' : 'in-progress') : 'ready',
      blockedBy: undefined,
      ...(spike !== undefined && answer !== undefined
        ? {
            findings: [...(state.findings ?? []), { at: at(ctx), by: ctx.agent, question: spike, text: answer }]
          }
        : {}),
      notes: [
        ...state.notes,
        { at: at(ctx), by: ctx.agent, text: answer === undefined ? 'Unblocked' : `Unblocked: ${answer}` },
        ...(brought.length > 0
          ? [
              {
                at: at(ctx),
                by: 'plitzi',
                text: `Its copy brought what the run approved meanwhile: ${brought.join(', ')}`
              }
            ]
          : [])
      ]
    }),
    ctx.now
  );
};

/** `plitzi task note` and `plitzi task handoff`: what whoever comes next must know. */
export const noteTask = async (ctx: RunContext, runId: string, taskId: string, text: string): Promise<void> => {
  const loaded = await loadRun(ctx, runId, { anyVersion: true });
  const task = findTask(loaded, taskId);
  const view = await holderOrCoordinator(ctx, loaded, task);
  await updateState(
    view.paths,
    state => ({ ...state, notes: [...state.notes, { at: at(ctx), by: ctx.agent, text }] }),
    ctx.now
  );
};
