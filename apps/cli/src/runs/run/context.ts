import { RunRefusal } from '../refusal';

import type { CheckRunner } from '../checks';
import type { RunPlan, RunRecord, RunTask } from '../model';
import type { RunPaths } from '../paths';

/**
 * Who acts on a run — an agent, the lead, or a person at a terminal — and what a run is, loaded: what every step reads.
 */

/** Asks a person to confirm `action` on `runId`, by typing the run's name; false when no person can be asked here. */
export type PersonGate = (runId: string, action: string) => Promise<boolean>;

export interface RunContext {
  root: string;
  now: () => Date;
  machine: string;
  cli: string;
  /** The caller's task token: an agent working a task. A person, or the lead, has none. */
  token?: string;
  /** Who is calling, for the log: an agent's name, or `person`. */
  agent: string;
  person: PersonGate;
  checks: CheckRunner;
}

export interface LoadedRun {
  paths: RunPaths;
  plan: RunPlan;
  record: RunRecord;
  tasks: RunTask[];
}

/** A person's action: refused with a task's token, and without a person at the terminal to confirm it. */
export const requirePerson = async (ctx: RunContext, runId: string, action: string): Promise<void> => {
  if (ctx.token !== undefined) {
    throw new RunRefusal('person-only', `Only a person may ${action}: a task's token cannot.`);
  }

  if (!(await ctx.person(runId, action))) {
    throw new RunRefusal(
      'person-only',
      `Only a person may ${action}, confirming it by typing the run's name in their own terminal.`
    );
  }
};

/** The lead's or a person's: refused with a task's token — a task does not approve, stop or reassign. */
export const requireNoTask = (ctx: RunContext, action: string): void => {
  if (ctx.token !== undefined) {
    throw new RunRefusal('person-only', `A task's token cannot ${action}: the lead or a person does.`);
  }
};
