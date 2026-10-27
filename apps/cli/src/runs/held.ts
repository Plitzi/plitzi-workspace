import { isResearch } from './spike';
import { isWorked } from './worked';

import type { TaskView } from './taskStore';

/**
 * What an agent has in hand — a card at work (research too), a step of a review — read one way for every kind: the
 * keeper's "who is busy", a command's "what you hold", the sign of life an agent gives at it. They differ only in who
 * may take one and who moves it on, which stays with each (`next.ts`, `nextRules.ts`).
 */

export const HELD_KINDS = ['work', 'review'] as const;

export type HeldKind = (typeof HELD_KINDS)[number];

export interface Held {
  task: string;
  kind: HeldKind;
  agent: string;
  /** A research card at work: it ends with what it found. */
  research?: true;
}

/** Who holds a task now, and as what: its worker — a scout at a research card — or the reviewer at its review's step. */
export const holdsOf = (view: TaskView): Held[] => {
  const task = view.task.id;

  return [
    ...(view.owner && isWorked(view.state.status)
      ? [
          {
            task,
            kind: 'work' as const,
            agent: view.owner.agent,
            ...(isResearch(view.task) ? { research: true as const } : {})
          }
        ]
      : []),
    ...(view.state.status === 'in-review' && view.state.review?.by !== undefined
      ? [{ task, kind: 'review' as const, agent: view.state.review.by }]
      : [])
  ];
};

/** What `agent` holds across the run's tasks: its work first, then what it reviews. */
export const heldBy = (views: readonly TaskView[], agent: string): Held[] =>
  views
    .flatMap(holdsOf)
    .filter(held => held.agent === agent)
    .sort((a, b) => HELD_KINDS.indexOf(a.kind) - HELD_KINDS.indexOf(b.kind));

/** A kind of hold, as a sentence says it. */
export const HELD_WORD: Readonly<Record<HeldKind, string>> = {
  work: 'task at work',
  review: 'review'
};

/** What ends a hold of each kind, as the command that moves it on: said to whoever gives a sign of life at it. */
export const endsWith = (held: Held): string =>
  held.kind === 'work'
    ? held.research
      ? `plitzi task complete --found "…" [--tasks <stage.json>]`
      : `plitzi task complete`
    : `its look (plitzi task look ${held.task}) and its verdict (plitzi task review ${held.task} --approve | --changes "…")`;
