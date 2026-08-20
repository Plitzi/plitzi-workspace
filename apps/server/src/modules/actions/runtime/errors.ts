import type { ActionErrorReason } from '@plitzi/sdk-shared';

/**
 * A run that stopped for a reason the caller is entitled to know, as opposed to one whose step threw.
 *
 * Its own file so the precheck and the runner can both raise it without either importing the other — the
 * precheck is called BY the runner and BEFORE it, and a shared error type is the only thing they have in common.
 */
export class ActionRunError extends Error {
  reason: ActionErrorReason;

  constructor(reason: ActionErrorReason, message: string) {
    super(message);
    this.name = 'ActionRunError';
    this.reason = reason;
  }
}
