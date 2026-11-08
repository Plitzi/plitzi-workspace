import type { ActionRunResult } from '../types';

/** How a job ends badly: given up, set aside at a limit, or out of attempts — and what its line says. */

/**
 * Why a run that ended badly did, in the words an operator can act on: the step that failed and what it said.
 *
 * Read from `steps` — the outline, whose errors are already redacted of every credential the run resolved — so
 * nothing lands on the job that the run history would not show. A run that failed without any step failing (a
 * timeout between steps, a budget spent) has no step to name, and says how it ended instead.
 */
export const failureOf = (result: ActionRunResult): string => {
  const failed = result.steps.find(step => step.phase === 'flow' && step.status === 'failed');

  return failed
    ? `step "${failed.id}" failed: ${failed.error ?? 'no reason given'}`
    : `the flow ended ${result.status}`;
};

/**
 * Refusals no number of attempts will change: the action was deleted, its schedule was switched off, or the
 * document refuses this trigger. Retrying is noise, and the job stops where an operator can see why.
 */
export const GIVE_UP = new Set(['not_found', 'disabled', 'forbidden', 'recursion']);

/**
 * The limits the same code meets again on every attempt — what it spends of CPU, memory, calls, output, steps or
 * requests, and its plan's allowance for the period spent (`quota`): a job stopped at one is set aside at once, for its
 * owner to fix or its plan to allow more, rather than run twice more for nothing. Time is not among them: an API slow
 * for a minute answers the next attempt.
 */
export const SET_ASIDE_LIMITS = new Set(['cpu', 'memory', 'calls', 'output', 'steps', 'requests', 'response', 'quota']);

/** Why a job stopped at one of {@link SET_ASIDE_LIMITS} waits for somebody. */
export const limitSetAsideError = (said: string): string =>
  `Set aside at once: it reached a limit its plan sets, which it would reach again on every attempt. Fix it, or give ` +
  `its plan more, then resume it. It said: ${said}`;

/**
 * Why a job that failed every attempt waits: it is set aside (`paused`) for somebody to read its runs and decide —
 * resume it once fixed, with every attempt again, or cancel it.
 */
export const failedOutError = (attempts: number, last: string): string =>
  `Set aside after ${String(attempts)} failed attempt${attempts === 1 ? '' : 's'}: look at its runs, then resume it ` +
  `once fixed — every attempt again — or cancel it. The last said: ${last}`;
