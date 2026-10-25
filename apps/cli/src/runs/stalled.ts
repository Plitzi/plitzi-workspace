import { DEVELOPER } from './team';
import { isWorked } from './worked';

import type { HeldFile } from './tasks';
import type { TaskView } from './taskStore';
import type { Attention } from './view';

/**
 * A run that stands still: nothing worked, nothing in review, tasks left — said to the lead with what holds each one,
 * so it is never the person who finds it. A run stood still past ten minutes while its lead's watch said "nothing new":
 * a ready task offered to nobody (a file of it held by a task blocked waiting for it), the developer that could take
 * it stopped as having nothing. Each line here is read off the run, with the way out.
 */

/** How long nothing moves before the run is said to stand still: past one slow command, well under a lost half hour. */
export const STALL_MS = 5 * 60_000;

/** A file a task needs, held by another task's lock — what `task next` refuses to offer it for. */
export interface HeldBy {
  file: string;
  task: string;
}

/** The lock that keeps a task from being offered — another task's, still live — read as `task next` reads it. */
export const lockHolder =
  (locks: ReadonlyMap<string, readonly HeldFile[]>, runId: string) =>
  (view: TaskView): HeldBy | undefined => {
    for (const file of view.task.files) {
      const other = (locks.get(file) ?? []).find(
        each => each.live && !(each.run === runId && each.task === view.task.id)
      );
      if (other) {
        return { file, task: other.task };
      }
    }

    return undefined;
  };

/**
 * A ready task none can take because another task of the run holds a file of it — claimed ahead of it — said to the
 * lead with what frees it. A run's t-crate-radio sat ready 22 minutes, three developers free: d-follow-names had
 * claimed its test file, the agents read why, and the lead's watch said only that the designers had nothing to take.
 */
export const heldAhead = (views: readonly TaskView[], heldBy: (view: TaskView) => HeldBy | undefined): Attention[] => {
  const byId = new Map(views.map(view => [view.task.id, view] as const));

  return views.flatMap(view => {
    const held = view.state.status === 'ready' ? heldBy(view) : undefined;
    const holder = held ? byId.get(held.task) : undefined;
    if (!held || !holder || holder.state.status === 'done') {
      return [];
    }

    return [
      {
        kind: 'held-ahead' as const,
        task: view.task.id,
        subject: `${view.task.id}:${held.task}:${held.file}`,
        text: `${view.task.id} is ready, and none can take it: ${held.task} holds ${held.file}, claimed ahead of it — it is free once ${held.task} is approved (${holder.state.status} now): review ${held.task} first, or ${held.task} lets the file go (plitzi task release ${held.file})`,
        who: 'lead' as const
      }
    ];
  });
};

export const stalled = (
  views: readonly TaskView[],
  /** The lock that keeps a ready task from being offered, if one does. */
  heldBy: (view: TaskView) => HeldBy | undefined,
  /** The agents running now. */
  running: ReadonlySet<string>,
  now: Date
): Attention[] => {
  const left = views.filter(view => view.state.status !== 'done');
  // Worked by a running agent, or waiting on a review — the lead's, which its own notices say: either is the run moving.
  const moving = views.some(
    view =>
      view.state.status === 'in-review' ||
      view.state.status === 'spike' ||
      (view.owner !== undefined && isWorked(view.state.status) && running.has(view.owner.agent))
  );
  if (left.length === 0 || moving) {
    return [];
  }

  const last = Math.max(...views.map(view => Date.parse(view.state.updatedAt)));
  const still = now.getTime() - last;
  if (still < STALL_MS) {
    return [];
  }

  const byId = new Map(views.map(view => [view.task.id, view] as const));
  const lines = left.flatMap(view => {
    const { status } = view.state;
    if (status === 'blocked') {
      return [`${view.task.id} is blocked: ${view.state.blockedBy?.reason ?? 'no reason said'}`];
    }

    if (status !== 'ready') {
      return [];
    }

    const held = heldBy(view);
    if (!held) {
      return [
        `${view.task.id} is ready and nobody takes it: start an agent of its role (${view.task.role ?? DEVELOPER}) — plitzi run agent <name> --launch`
      ];
    }

    const holder = byId.get(held.task);

    return [
      `${view.task.id} is ready, offered to nobody: ${held.file} is held by ${held.task}${
        holder?.state.status === 'blocked'
          ? ` — itself blocked (${holder.state.blockedBy?.reason ?? 'no reason said'}): the block holds the file its own wait needs. Unblock ${held.task} asking it to let the file go (plitzi task release ${held.file}), then block again`
          : ` (${holder?.state.status ?? 'another run'})`
      }`
    ];
  });

  return [
    {
      kind: 'stalled',
      // Said again only when what holds the run changes, not each minute it stays so.
      subject: lines.join('|'),
      text: `The run stands still: nothing has moved for ${String(Math.round(still / 60_000))} min — no task worked or in review. ${lines.join('; ')}`,
      who: 'lead'
    }
  ];
};
