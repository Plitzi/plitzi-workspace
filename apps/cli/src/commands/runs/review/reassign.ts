import { reassignTask, revertTask } from '../../../runs/tasks';
import { act, runOf } from '../shell';
import { list } from '../text';

import type { RunCommandOptions } from '../shell';

/** A task taken back by the lead: from its agent to another (`task reassign`), or its approved work out of the run's. */

export const taskReassign = (
  taskId: string,
  options: RunCommandOptions & { reason?: string; to?: string }
): Promise<void> =>
  act(
    options,
    async ctx =>
      reassignTask(ctx, await runOf(ctx, options), taskId, {
        ...(options.reason ? { reason: options.reason } : {}),
        ...(options.to ? { to: options.to } : {})
      }),
    reassigned =>
      [
        `${taskId} is taken back${reassigned.from ? ` from ${reassigned.from} — its token revoked, told why on its next command` : ''}. ${
          reassigned.reviewedRound === undefined
            ? 'It was never reviewed: it starts from scratch.'
            : `It starts again from the version its review ${String(reassigned.reviewedRound)} saw.`
        }`,
        reassigned.taken
          ? `Yours now: its copy is ${reassigned.taken.work} — work there with your token, then plitzi task complete`
          : reassigned.to
            ? `Handed to ${reassigned.to}: its next plitzi task next gives it, and no other agent takes it.`
            : 'Ready for whoever takes it next.',
        ...(reassigned.servers.length > 0
          ? [`Stopped what it left listening in its copy: ${reassigned.servers.join(', ')}.`]
          : []),
        ...(reassigned.serversUnsaid === undefined
          ? []
          : [
              `What it left listening in its copy was not looked for: ${reassigned.serversUnsaid} — one still running holds its port until it is stopped.`
            ]),
        ...(reassigned.released.length > 0
          ? [
              `Let go of what it held by turns: ${reassigned.released.join(', ')}${reassigned.granted.length > 0 ? ` — to ${reassigned.granted.join(', ')}` : ''}${reassigned.settled.length > 0 ? `; merged: ${reassigned.settled.join(', ')}` : ''}${reassigned.integrations.length > 0 ? `; to integrate: ${reassigned.integrations.join(', ')}` : ''}.`
            ]
          : [])
      ].join('\n')
  );

export const taskRevert = (taskId: string, options: RunCommandOptions & { reason?: string }): Promise<void> =>
  act(
    options,
    async ctx => revertTask(ctx, await runOf(ctx, options), taskId, options.reason),
    reverted =>
      [
        `${taskId} reverted in the run's work: ${list(reverted.reverted)}.`,
        ...(reverted.kept.length > 0
          ? [`  Not reverted — another task changed them since: ${reverted.kept.join(', ')}`]
          : []),
        ...(reverted.dependants.length > 0 ? [`  Built on it: ${reverted.dependants.join(', ')} — check them`] : [])
      ].join('\n')
  );
