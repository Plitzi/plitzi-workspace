import fs from 'node:fs/promises';

import { readyWhatWaited, sayIfAllDone, statesOf } from './handOn';
import { grantWaiters } from './locks';
import { integrateWhenReady, settleRequests } from './requests';
import { syncPreview } from '../copies/preview';
import { isWithin } from '../core/paths';
import { withLock } from '../core/store';
import { lockedFiles, revokeOwner, updateState } from '../core/taskStore';
import { logSpent } from '../report/spent';
import { loadRun, logRun, readApproved } from '../run';
import { proposalsOf } from '../talk/agreements';
import { LEAD, sendMessage } from '../talk/messages';

import type { ReviewedTask } from './review';
import type { TaskView } from '../core/taskStore';
import type { LoadedRun, RunContext } from '../run';

/** What an approval brought into the run's work, as `closeApproved` says it. */
export interface Approval {
  round: number;
  /** Its files that went into the run's work. */
  merged: string[];
  /** The shared files its requests went into, and those that did not, and why. */
  fulfilled: string[];
  unmerged?: { files: string[]; reason: string };
  notReviewed: string[];
  /** The role whose step approved it — its last, or the lead's word on any. */
  step?: string;
  /** The checks' steps the run's work already failed without it, failed the same way with it: not its own. */
  runFails?: string[];
}

/**
 * A task whose work is in the run's now, closed: done, its files let go of and handed on, what waited on it made
 * ready, the tasks it agreed with told, the preview synced — whatever approved it, alone or beside another
 * (`task review --with`).
 */
export const closeApproved = async (
  ctx: RunContext,
  loaded: LoadedRun,
  view: TaskView,
  { round, merged, fulfilled, unmerged, notReviewed, step, runFails }: Approval
): Promise<ReviewedTask> => {
  const verdict = 'approve' as const;
  const taskId = view.task.id;
  const { runId } = loaded.record;
  const released = [...(await lockedFiles(view.paths)).keys()];
  await fs.rm(view.paths.locks, { recursive: true, force: true });
  await revokeOwner(view.paths);
  await updateState(view.paths, state => ({ ...state, round, status: 'done', review: undefined }), ctx.now);
  // Said the moment it is so: the approval is in the run's work, whatever the steps after it meet — written last, one
  // that failed after it left an approval the log never had (t-tier-list, approved and nowhere in the log).
  await logRun(ctx, loaded.paths, {
    action: 'review',
    task: taskId,
    verdict,
    round,
    merged,
    fulfilled,
    // Nothing silent: a request that did not go in, and why — its integration task applies it.
    ...(unmerged ? { unmerged } : {}),
    ...(step === undefined ? {} : { step }),
    ...(runFails && runFails.length > 0 ? { runFails } : {})
  });
  await logSpent(ctx, loaded, taskId, 'review');
  // Its copy goes — but never from under the shell that approved it: one there was left in a folder gone, every command
  // after it failing on getcwd (a run's test-1, approving where it ran the checks). Left, it goes with the run.
  const callerInCopy = ctx.cwd !== undefined && isWithin(view.paths.cache, ctx.cwd);
  if (!callerInCopy) {
    await fs.rm(view.paths.cache, { recursive: true, force: true });
  }

  const refreshed = await loadRun(ctx, runId);
  const granted = await grantWaiters(ctx, refreshed, released);
  const settled = await settleRequests(ctx, refreshed, released);
  const ready = await readyWhatWaited(ctx, refreshed);
  const states = await statesOf(refreshed);

  // What another task agreed with this one may wait on this one's work: it is in the run's now — said to each, so an
  // agreement accepted before it could be applied is applied, not forgotten.
  const agreed = (await proposalsOf(refreshed)).filter(
    each => each.from === taskId && each.answer?.verdict === 'accept' && states.get(each.to)?.status !== 'done'
  );
  for (const each of agreed) {
    await sendMessage(ctx, refreshed, {
      from: taskId,
      to: each.to,
      text: `${taskId} is approved: what you agreed with it (${each.id}: ${each.change.slice(0, 160)}${each.change.length > 160 ? '…' : ''}) can be applied now — its files are in the run's work, and your copy brings them with your next complete or plitzi task discard <file>`
    });
  }

  // Went in over what the run's work already failed: the lead hears it — the finish needs it green, and whoever broke it
  // fixes it — never the task that met it.
  if (runFails && runFails.length > 0) {
    await sendMessage(ctx, refreshed, {
      from: taskId,
      to: LEAD,
      fyi: true,
      text: `${taskId} is approved over checks the run's work already fails without it (${runFails.join(', ')}), failed the same way: not its own. The finish needs them green — whoever's approval broke them fixes it`
    });
  }

  // What the approval let go: the files handed to the tasks waiting for them, and the tasks it made ready.
  if (granted.length > 0 || ready.length > 0) {
    await logRun(ctx, loaded.paths, { action: 'handed-on', task: taskId, granted, ready });
  }

  // What is connected shows as it is approved: a running preview of the run takes the approved work in now. A preview
  // that cannot take it is said, never the approval undone by it.
  const previewProblem = await syncPreview(refreshed, ctx.root).then(
    () => undefined,
    (error: unknown) => (error instanceof Error ? error.message : String(error))
  );
  if (previewProblem !== undefined) {
    await logRun(ctx, loaded.paths, { action: 'preview-sync-failed', task: taskId, error: previewProblem });
  }

  const integrations = await withLock(refreshed.paths.mergeLock, () => integrateWhenReady(ctx, refreshed), {
    now: ctx.now
  });

  // The last approval — no integration made by it either: every task of the run done.
  await sayIfAllDone(ctx, runId);

  const joined = Object.entries((await readApproved(loaded.paths)).files)
    .filter(([, entry]) => entry.task === taskId && entry.joined !== undefined)
    .map(([file]) => file);

  return {
    verdict,
    round,
    merged,
    granted,
    ready: [...ready, ...integrations],
    integrations,
    ...(previewProblem === undefined ? {} : { previewProblem }),
    settled,
    fulfilled,
    ...(unmerged ? { unmerged } : {}),
    ...(runFails && runFails.length > 0 ? { runFails } : {}),
    ...(joined.length > 0 ? { joined } : {}),
    ...(notReviewed.length > 0 ? { notReviewed } : {}),
    ...(callerInCopy ? { copyLeft: ctx.root } : {})
  };
};
