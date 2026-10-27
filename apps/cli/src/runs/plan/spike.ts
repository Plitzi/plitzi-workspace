import { isRecord } from '@plitzi/sdk-shared/helpers';

import { DEVELOPER, SCOUT } from '../agents/team';
import { isString } from '../core/guards';

import type { TaskState } from '../core/model';

/**
 * A research card (a spike): what is read before a plan is written — a card like any on the board, taken by a scout (the
 * lead finds it out itself with none), completed with what it found (`task complete --found`) and reviewed by the lead.
 * A card with no files and a question (`"spike"`); its result is the run's next tasks, each with what was found for it
 * (`findings`). A run opens on one — the person's ask, its scope (`scopePlan`) — and every task flows from it; a spike
 * later is the lead's to plan, when the work asks for one.
 */

/** What an agent found out, said by `task complete --found`, or by the lead's answer to a block. */
export interface Finding {
  at: string;
  by: string;
  /** The question it answers: the plan's spike, or the one its agent asked when it moved the task back. */
  question: string;
  text: string;
}

export const isFinding = (value: unknown): value is Finding =>
  isRecord(value) && isString(value.at) && isString(value.by) && isString(value.question) && isString(value.text);

/** Research alone: a spike, and no file to write — done once its findings are said. */
export const isResearch = (task: { spike?: string; files: readonly string[] }): boolean =>
  task.spike !== undefined && task.files.length === 0;

/**
 * Whether a run opens on research alone — its scope, or an ask's parts each a card of their own: what they find is its
 * work, and nothing else is on the board until then. A big ask is split so its parts are found out at once.
 */
export const opensOnResearch = (tasks: readonly { spike?: string; files: readonly string[] }[]): boolean =>
  tasks.length > 0 && tasks.every(isResearch);

/** The role a card is for: its own, a scout's for research (the lead finds it out with none), else a developer's. */
export const roleOf = (task: { role?: string; spike?: string; files: readonly string[] }): string =>
  task.role ?? (isResearch(task) ? SCOUT : DEVELOPER);

/** The question a plan's own finding for a task answers, as its state keeps it: `run amend` replaces it by this. */
export const PLAN_FINDING = 'its spike';

/**
 * A task's state before anyone starts it, as the run opens or a stage is stacked: ready, or pending on what it waits for —
 * with what the spike that made it found for it, kept as the run's findings.
 */
export const startingState = (
  task: { spike?: string; files: readonly string[]; findings?: string },
  dependenciesDone: boolean,
  at: string
): TaskState => ({
  // Research waits for what it depends on too: handed out before, it was found out on work not there yet.
  status: dependenciesDone ? 'ready' : 'pending',
  round: 0,
  notes: [],
  updatedAt: at,
  ...(task.findings === undefined
    ? {}
    : { findings: [{ at, by: 'lead', question: PLAN_FINDING, text: task.findings }] })
});

/** The id of a run's first spike: its scope. */
export const SCOPE_SPIKE = 's-scope';

/**
 * A run on the person's ask alone: its plan one spike — the scope, a scout's, the lead's with none — whose result is the
 * tasks (`plitzi run start "…"`). As any project starts: it is scoped, and the work flows from there.
 */
export const scopePlan = (runId: string, ask: string, reference?: string) => ({
  version: 1 as const,
  runId,
  goal: ask,
  ...(reference === undefined ? {} : { reference }),
  tasks: [
    {
      id: SCOPE_SPIKE,
      title: 'The scope: what the ask takes, as the run’s tasks',
      files: [],
      dependsOn: [],
      priority: 'critical' as const,
      estimateMinutes: 30,
      acceptance: ['Its result is the run’s tasks, each with what was found for it'],
      spike: ask
    }
  ]
});
