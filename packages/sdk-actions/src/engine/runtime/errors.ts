import { FunctionFailure } from '@plitzi/sdk-shared/functions';

import type { ActionErrorReason, ActionRunLimit, ActionRunStep } from '@plitzi/sdk-shared';
import type { FunctionFailureReason } from '@plitzi/sdk-shared/functions';

/**
 * A run that stopped for a reason the caller is entitled to know, as opposed to one whose step threw.
 *
 * Its own file so the precheck and the runner can both raise it without either importing the other — the
 * precheck is called BY the runner and BEFORE it, and a shared error type is the only thing they have in common.
 */
export class ActionRunError extends Error {
  reason: ActionErrorReason;
  /**
   * The steps a run that STARTED took before it hit this — its deadline, a budget — set by the runner as it rethrows.
   * A refusal before the run began has none. The same outline a completed run returns, and nothing more.
   */
  steps?: ActionRunStep[];
  /** The limit it is, when it is one (its deadline, its step budget…): a ceiling reached, never a fault. */
  limit?: ActionRunLimit;

  constructor(reason: ActionErrorReason, message: string, limit?: ActionRunLimit) {
    super(message);
    this.name = 'ActionRunError';
    this.reason = reason;
    if (limit) {
      this.limit = limit;
    }
  }
}

/**
 * A step stopped at a limit of what its run may spend — its account's CPU budget — failing that step as any error
 * does, while saying it was a limit and not a fault.
 */
export class RunLimitReached extends Error {
  limit: ActionRunLimit;

  constructor(limit: ActionRunLimit, message: string) {
    super(message);
    this.name = 'RunLimitReached';
    this.limit = limit;
  }
}

/** The runner's reasons that are limits — the code asked for more than it may — rather than faults or refusals. */
const STOPS: ReadonlySet<FunctionFailureReason> = new Set(['cpu', 'wall', 'memory', 'output', 'calls']);

const isStop = (reason: FunctionFailureReason): reason is ActionRunLimit & FunctionFailureReason => STOPS.has(reason);

/** The limit an error that ended a run says it is: a ceiling of the run's, one of its step's, or its code's runner's. */
export const limitOf = (error: unknown): ActionRunLimit | undefined => {
  if (error instanceof ActionRunError || error instanceof RunLimitReached) {
    return error.limit;
  }

  return error instanceof FunctionFailure && isStop(error.reason) ? error.reason : undefined;
};
