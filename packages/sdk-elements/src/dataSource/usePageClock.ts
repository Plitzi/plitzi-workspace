import { useEffect, useState } from 'react';

import { TIME_GRAIN_MS } from '@plitzi/sdk-shared/helpers/twigWrapper';
import { useCommonStore } from '@plitzi/sdk-shared/store';

/** The start of the minute an instant is in. */
export const minuteOf = (at: number): number => at - (at % TIME_GRAIN_MS);

/** The day an instant is in, in UTC: `2026-11-24`. */
export const dayOf = (at: number): string => new Date(at).toISOString().slice(0, 10);

/**
 * The page's clock, minute by minute — what `time.now` reads. Drawn at the minute the server drew the page at (its
 * `clock`), so the page hydrates on what it was drawn with; then the browser's own, moving on at each minute's turn and
 * at once when the page comes back into view (a hidden tab's timers are held back). The minute the builder simulates
 * is kept as it is.
 */
const usePageClock = (): number => {
  const [clock] = useCommonStore('clock');
  const [now, setNow] = useState(() => minuteOf(clock?.at ?? Date.now()));

  useEffect(() => {
    setNow(minuteOf(clock?.simulated ? clock.at : Date.now()));
  }, [clock]);

  useEffect(() => {
    if (clock?.simulated) {
      return undefined;
    }

    const timer = setTimeout(() => setNow(minuteOf(Date.now())), TIME_GRAIN_MS - (Date.now() % TIME_GRAIN_MS));
    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        setNow(minuteOf(Date.now()));
      }
    };
    document.addEventListener('visibilitychange', handleVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, [clock, now]);

  return now;
};

export default usePageClock;
