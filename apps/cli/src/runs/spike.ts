import { isRecord } from '@plitzi/sdk-shared/helpers';

import { isString } from './guards';

import type { TaskState } from './model';

/**
 * A spike: research in the run, a lead's — what the lead read before writing a plan, done where the monitor sees it.
 * A task with no files and a question (`"spike"`); its result is the run's next tasks, each with what was found for it
 * (`findings`). A run opens on one — the person's ask, its scope (`scopePlan`) — and every task flows from it; a spike
 * later is the lead's to open, when the work asks for one.
 */

/** What an agent found out, said by `task spike --done`. */
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

/** The question a plan's own finding for a task answers, as its state keeps it: `run amend` replaces it by this. */
export const PLAN_FINDING = 'its spike';

/**
 * A task's state before anyone starts it, as the run opens or a stage is stacked: a spike from the start, else ready or
 * pending on what it waits for — with what the spike that made it found for it, kept as the run's findings.
 */
export const startingState = (
  task: { spike?: string; files: readonly string[]; findings?: string },
  dependenciesDone: boolean,
  at: string
): TaskState => ({
  status: isResearch(task) ? 'spike' : dependenciesDone ? 'ready' : 'pending',
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
 * A run on the person's ask alone: its plan one spike — the scope, the lead's — whose result is the tasks (`plitzi run
 * open --spike "…"`). As any project starts: the lead scopes it, and the work flows from there.
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
