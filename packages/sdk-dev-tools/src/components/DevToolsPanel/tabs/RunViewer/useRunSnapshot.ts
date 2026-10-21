import { useEffect, useState } from 'react';

import { isRunSnapshot, RUN_STATUS_PATH } from '@plitzi/sdk-shared/runs';

import type { RunSnapshot } from '@plitzi/sdk-shared/runs';

/** How often the run is asked again while the panel is open: the preview's server rewrites it every two seconds. */
const EVERY_MS = 3000;

/**
 * The run of agents this page's server previews (`plitzi run preview`), as the CLI keeps it — asked for only when the
 * server said it previews one (`previews`): any other server has no run, and asking it every few seconds left a 404 in
 * the page's console each time. Without one the Run tab is not offered.
 */
const useRunSnapshot = (previews: boolean): RunSnapshot | undefined => {
  const [snapshot, setSnapshot] = useState<RunSnapshot | undefined>();

  useEffect(() => {
    if (!previews || typeof window === 'undefined') {
      return undefined;
    }

    let stopped = false;
    const look = async (): Promise<void> => {
      try {
        const response = await fetch(RUN_STATUS_PATH, { cache: 'no-store' });
        const body: unknown = response.ok ? await response.json() : undefined;
        if (!stopped) {
          setSnapshot(isRunSnapshot(body) ? body : undefined);
        }
      } catch {
        // The server restarting (the preview swapping the run's work in): asked again on the next tick.
      }
    };
    void look();
    const timer = window.setInterval(() => void look(), EVERY_MS);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [previews]);

  return snapshot;
};

export default useRunSnapshot;
