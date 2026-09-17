import { useEffect, useState } from 'react';

/**
 * `Date.now()`, moving once a second while `active` — the finest step a countdown shows.
 *
 * Never earlier than `floor`: the clock is a render-time snapshot, and a value written after it read as written in
 * the future — "0s ago" and "0s left" on an answer that was never current at all.
 */
const useSecondsClock = (active: boolean, floor = 0): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    const timer = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(timer);
  }, [active]);

  return Math.max(now, floor);
};

export default useSecondsClock;
