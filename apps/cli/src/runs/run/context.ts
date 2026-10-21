import { RunRefusal } from '../refusal';

import type { CheckRunner } from '../checks';
import type { Quality, RunPlan, RunRecord, RunTask } from '../model';
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
  /** The level the caller was started at (`--quality`, `PLITZI_QUALITY`): it is handed tasks of it or below. */
  quality?: Quality;
  person: PersonGate;
  checks: CheckRunner;
  /**
   * What a long command is at, said as it goes — to a person's terminal, apart from its answer — so a minute of checks
   * is never a command that hangs (velada-dress: `run finish --apply` ran 23 acceptance lines again, saying nothing).
   */
  say?: (line: string) => void;
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

/**
 * The lead's or a person's: refused with a task's token — a task does not approve, stop or reassign. A task's token is the agent's, and what it may not do is the lead's to do or to ask the person for: `lead-only`, the
 * agent told to tell it — never `person-only`, which sent an agent to ask a person it has none of (velada-dress: dev-1,
 * answering its own spike).
 */
export const requireNoTask = (ctx: RunContext, action: string): void => {
  if (ctx.token !== undefined) {
    throw new RunRefusal(
      'lead-only',
      `A task's token cannot ${action}: that is the lead's — tell it what you have (plitzi task tell "…"), and go on with your part.`
    );
  }
};
