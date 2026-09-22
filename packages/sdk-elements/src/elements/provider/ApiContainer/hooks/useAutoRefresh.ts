import { useEffect, useRef } from 'react';

export type UseAutoRefreshParams = {
  /** Seconds between refreshes. Zero, a negative number or anything that is not a number turns it off. */
  seconds: number | string;
  /** Whether there is anything to refresh at all — a provider that cannot fetch must not be asked to. */
  enabled: boolean;
  refresh: () => unknown;
};

/**
 * Asks a provider for its data again every `seconds`, for a page that shows something still moving.
 *
 * Three things a bare `setInterval` gets wrong, each of them a load the page's server pays for:
 *
 * - **A hidden tab does not ask.** Nobody is looking, and a dashboard left open in a background tab overnight is
 *   otherwise thousands of requests answering no one.
 * - **One at a time.** A refresh that outlives the interval is not joined by a second one — on a slow server that
 *   is how a poll turns into a pile-up.
 * - **The newest `refresh`, without restarting the clock.** The callback is read through a ref, so a re-render that
 *   hands over a new function does not reset the countdown to the full interval each time.
 */
const useAutoRefresh = ({ seconds, enabled, refresh }: UseAutoRefreshParams): void => {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const interval = Number(seconds);
  const active = enabled && Number.isFinite(interval) && interval > 0;

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    let inFlight = false;
    const timer = setInterval(() => {
      if (inFlight || document.visibilityState === 'hidden') {
        return;
      }

      inFlight = true;
      void Promise.resolve()
        .then(() => refreshRef.current())
        .catch(() => undefined)
        .finally(() => {
          inFlight = false;
        });
    }, interval * 1000);

    return () => clearInterval(timer);
  }, [active, interval]);
};

export default useAutoRefresh;
