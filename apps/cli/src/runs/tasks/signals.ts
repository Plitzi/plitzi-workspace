import { at, findTask, holderOf, holderOrCoordinator, refreshCopy } from './common';
import { letGoUntouched } from './locks';
import { requireLead } from '../agents/leads';
import { tellLeftInTmp } from '../copies/strays';
import { writeJson } from '../core/files';
import { asksLead } from '../core/model';
import { RunRefusal } from '../core/refusal';
import { DEFAULTS, noSignalAfter, updateState, viewTask } from '../core/taskStore';
import { longFilesIn } from '../plan/longFiles';
import { loadRun, logRun, requireNoTask } from '../run';
import { handOver } from '../talk/handOver';
import { LEAD, sendMessage } from '../talk/messages';

import type { Needs, TaskState } from '../core/model';
import type { LongFile } from '../plan/longFiles';
import type { RunContext } from '../run';
import type { Message } from '../talk/messages';

/**
 * What a task at work says while it works: its progress (the heartbeat), a block and its answer, a note.
 */

/** `plitzi task progress` and `plitzi task progress`: the holder's sign of life, with where it is if it says. */
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
    messages: await handOver(ctx, loaded, taskId, ctx.agent),
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
): Promise<{ released: string[]; granted: string[] }> => {
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

  return letGoUntouched(ctx, loaded, view);
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
  // Every block is the lead's to lift, an agent's question too: a scout finds out the run's spikes alone (Carlos).
  await requireLead(ctx, 'unblock a task');
  const task = findTask(loaded, taskId);
  const view = await viewTask(loaded.paths, task);

  if (view.state.status !== 'blocked') {
    throw new RunRefusal('invalid', `Task "${taskId}" is not blocked, it is ${view.state.status}`, { task: taskId });
  }

  // A question its agent asked the lead: lifted with the answer, kept as the task's finding.
  const question = asksLead(view.state) ? view.state.blockedBy?.reason : undefined;
  if (question !== undefined && answer === undefined) {
    throw new RunRefusal(
      'invalid',
      `${taskId} waits on the lead — ${question}: lift it with the answer — plitzi task unblock ${taskId} --answer "…" — kept as its finding`,
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
      ...(question !== undefined && answer !== undefined
        ? {
            findings: [...(state.findings ?? []), { at: at(ctx), by: ctx.agent, question, text: answer }]
          }
        : {}),
      notes: [
        ...state.notes,
        {
          at: at(ctx),
          by: ctx.agent,
          kind: 'unblocked',
          text: answer === undefined ? 'Unblocked' : `Unblocked: ${answer}`
        },
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
