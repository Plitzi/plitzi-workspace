import type { ActionErrorReason, ActionRunStep } from '@plitzi/sdk-shared';

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

  constructor(reason: ActionErrorReason, message: string) {
    super(message);
    this.name = 'ActionRunError';
    this.reason = reason;
  }
}

/**
 * A step refusing to go on, with a reason written for whoever called — a password too easy to guess, a board that is
 * read-only, a quota reached.
 *
 * What any other step throws stays in the run's record and never reaches the caller: an error can carry a query, a
 * URL, a credential's name, and a page is shown to anybody. This one says, by its type, that its message was written
 * to be read. A run that ends on it answers `status: 'failed'` with the message as `error`, which a page's flow reads
 * as `{{ step.error }}` — the same place a refusal before the run began puts its own.
 */
export class ActionRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActionRefusal';
  }
}
