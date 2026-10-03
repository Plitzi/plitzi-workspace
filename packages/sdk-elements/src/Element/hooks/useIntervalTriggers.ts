import { useEffect, useMemo } from 'react';

import { INTERVAL_TRIGGER, intervalOf } from '@plitzi/sdk-shared/helpers/interval';

import type { InteractionsManager } from '@plitzi/sdk-interactions';
import type { ElementInteraction } from '@plitzi/sdk-shared';
import type { IntervalTriggerPayload } from '@plitzi/sdk-shared/helpers/interval';

export type UseIntervalTriggersProps = {
  id: string;
  interactions?: Record<string, ElementInteraction>;
  previewMode: boolean;
  interactionsManager: InteractionsManager;
};

/**
 * The element's repeating flows: one clock per interval its `onInterval` flows declare, running while it is mounted.
 *
 * A clock ticks only while the tab is in view — a hidden tab is nobody watching, and an autoplay that kept turning
 * would greet them three slides further on. It does not tick in the builder outside preview, like every other
 * interaction. Each interval counts its own ticks, and a tick is for the flows declared with that interval alone.
 */
const useIntervalTriggers = ({
  id,
  interactions,
  previewMode,
  interactionsManager
}: UseIntervalTriggersProps): void => {
  const intervals = useMemo(
    () => [
      ...new Set(
        Object.values(interactions ?? {}).flatMap(node => {
          const interval = intervalOf(node.params.interval);

          return node.type === 'trigger' && node.action === INTERVAL_TRIGGER && node.enabled && interval
            ? [interval]
            : [];
        })
      )
    ],
    [interactions]
  );

  useEffect(() => {
    if (!previewMode || !intervals.length || typeof document === 'undefined') {
      return undefined;
    }

    const counts = new Map(intervals.map(interval => [interval, 0]));
    let timers: ReturnType<typeof setInterval>[] = [];
    const start = () => {
      timers = intervals.map(interval =>
        setInterval(() => {
          const count = (counts.get(interval) ?? 0) + 1;
          counts.set(interval, count);
          const payload: IntervalTriggerPayload = { interval, count };
          void interactionsManager.interactionTrigger(id, INTERVAL_TRIGGER, payload);
        }, interval)
      );
    };
    const stop = () => {
      timers.forEach(timer => clearInterval(timer));
      timers = [];
    };
    const onVisibility = () => {
      stop();
      if (document.visibilityState === 'visible') {
        start();
      }
    };

    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [id, interactionsManager, previewMode, intervals]);
};

export default useIntervalTriggers;
