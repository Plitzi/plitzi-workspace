import { RunRefusal } from '../core/refusal';
import { LEAD } from '../talk/messages';

import type { CheckRunner } from '../copies/checks';
import type { Quality, RunPlan, RunRecord, RunTask } from '../core/model';
import type { RunPaths } from '../core/paths';
import type { HarnessUsage } from '../harness';

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
  /**
   * The caller's shell folder: a task's copy is never removed from under it — a tester approving from inside the copy
   * it ran the checks in met getcwd errors on its next command. Not said: none is spared.
   */
  cwd?: string;
  /** Who is calling, for the log: an agent's name, or `person`. */
  agent: string;
  /** The level the caller was started at (`--quality`, `PLITZI_QUALITY`): it is handed tasks of it or below. */
  quality?: Quality;
  person: PersonGate;
  checks: CheckRunner;
  /**
   * What a long command is at, said as it goes — to a person's terminal, apart from its answer — so a minute of checks
   * is never a command that hangs (`run finish --apply` ran 23 acceptance lines again, saying nothing).
   */
  say?: (line: string) => void;
  /**
   * How many tokens the caller's harness session holds now (`harness/contextNow`) — what an agent between two pieces of
   * work is started again with a fresh context by (`TeamOptions.freshContextAt`). Not said, or unread: never.
   */
  context?: () => Promise<number | undefined>;
  /**
   * What the caller's harness spent in a window, read from its sessions — those its commands ran in, and this one's
   * (`harness/spentIn`): what a piece of work ended is kept by (`spent.ts`). Not said: nothing is kept.
   */
  spent?: (window: {
    from: string;
    to: string;
    sessions: string[];
    processes: string[];
  }) => Promise<HarnessUsage | undefined>;
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
 * agent told to tell it — never `person-only`, which sent an agent to ask a person it has none of (dev-1,
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

/**
 * `lead`'s, or a person's, by who calls — proved (`identity.ts`), so a name is no way in: an agent of the run holding
 * no task, a designer or a tester, is refused as a task's token is.
 */
export const requirePrincipal = (ctx: RunContext, action: string): void => {
  requireNoTask(ctx, action);
  if (ctx.agent !== LEAD && ctx.agent !== 'person') {
    throw new RunRefusal(
      'lead-only',
      `${ctx.agent} cannot ${action}: that is the lead's — tell it what you have (plitzi task tell "…")`,
      {
        holder: LEAD
      }
    );
  }
};
