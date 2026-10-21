import { isRecord } from '@plitzi/sdk-shared/helpers';

import { isString } from './guards';

/**
 * A task's spike: what it is to find out before it is ready to build — the part of the work that is research, done in
 * the run, by an agent, where the lead did it alone outside it. A task with one starts in `spike`; one with no files is
 * research alone, done once its findings are said. An agent at work that finds it must look something up moves its
 * task back to `spike`, and on once it knows.
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

/** A task's status before anyone starts it: its spike first, if it has one not answered — else ready or pending. */
export const startingStatus = (
  task: { spike?: string; dependsOn: readonly string[] },
  dependenciesDone: boolean,
  findings: readonly Finding[] = []
): 'spike' | 'ready' | 'pending' =>
  task.spike !== undefined && findings.length === 0 ? 'spike' : dependenciesDone ? 'ready' : 'pending';
