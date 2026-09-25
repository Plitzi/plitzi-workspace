import { serverLog } from '../../../helpers/serverLog';

/** How long a pass may keep failing before it is reported as the error it has become. */
export const FAILURE_STREAK_ESCALATION_MS = 60_000;

export type FailureStreak = {
  failed: (error: unknown) => void;
  succeeded: () => void;
};

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * How a pass that runs again by itself reports failing: a schedule sweep, a claim, a heartbeat.
 *
 * A store that drops its connections for a moment — a failover, a driver resetting its pool because the host stalled
 * — fails one pass, and the next, seconds later, works. Nothing is lost: every pass is safe to repeat. Reported as an
 * error with a stack, each of those read as an incident, and the ones that are an incident read the same.
 *
 * So the first failure of a streak is a warning with its reason; a streak still going after `escalateAfterMs` is the
 * error, with the whole cause, once; and the pass that ends a streak that got that far says so.
 */
export const createFailureStreak = (
  scope: string,
  what: string,
  escalateAfterMs = FAILURE_STREAK_ESCALATION_MS,
  now: () => number = Date.now
): FailureStreak => {
  let since: number | undefined;
  let failures = 0;
  let escalated = false;

  return {
    failed: error => {
      failures += 1;

      if (since === undefined) {
        since = now();
        serverLog.warn(scope, `${what} failed, trying again`, reasonOf(error));

        return;
      }

      const elapsed = now() - since;
      if (!escalated && elapsed >= escalateAfterMs) {
        escalated = true;
        serverLog.error(scope, `${what} has been failing for ${String(Math.round(elapsed / 1000))}s`, error);
      }
    },
    succeeded: () => {
      if (since === undefined) {
        return;
      }

      if (escalated) {
        const seconds = Math.round((now() - since) / 1000);
        serverLog.info(scope, `${what} is working again, after ${String(failures)} failures over ${String(seconds)}s`);
      }

      since = undefined;
      failures = 0;
      escalated = false;
    }
  };
};
