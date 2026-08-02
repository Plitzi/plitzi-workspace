import { throttle } from '@plitzi/plitzi-ui/helpers';
import { use, useCallback, useEffect, useMemo, useRef } from 'react';

import { RTEvent } from '@plitzi/sdk-shared/websockets/RTCodec';
import { collaboratorAnchorSelector, readCursorAnchor } from '@pmodules/Collaboration/CollaborationHelper';
import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';

import type { CollaboratorCursorAnchor } from '@pmodules/Collaboration/CollaborationHelper';

export type UseCollaboratorCursorProps = {
  rootId: string;
  zoom?: number;
  enabled?: boolean;
};

const SAMPLE_INTERVAL = 50;

/**
 * Broadcasts this user's pointer over a canvas. Returns the props to spread on the canvas element; the whole
 * lifecycle (enter, sampled moves, leave) lives here, so a caller never has to remember that a cursor left
 * behind on a peer's screen stays there forever.
 */
const useCollaboratorCursor = ({ rootId, zoom = 1, enabled = true }: UseCollaboratorCursorProps) => {
  const { supportRealTime, subscriptionsPush } = use(BuilderSubscriptionsContext);
  const tracking = enabled && supportRealTime;

  const lastEventRef = useRef<PointerEvent | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  // Guards every send: the throttle owes a trailing call and an animation frame may already be queued, and a
  // move landing after the leave puts the cursor back on the peers' canvas, frozen there for good.
  const activeRef = useRef(false);

  const selector = collaboratorAnchorSelector(rootId);

  const stopSampling = useCallback(() => {
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    lastEventRef.current = null;
    anchorRef.current = null;
  }, []);

  const leave = useCallback(() => {
    if (!activeRef.current) {
      return;
    }

    activeRef.current = false;
    stopSampling();
    subscriptionsPush({ type: RTEvent.MOUSE, payload: { action: 'mouseLeave', rootId } });
  }, [rootId, stopSampling, subscriptionsPush]);

  const throttledSend = useMemo(
    () =>
      throttle((position: CollaboratorCursorAnchor) => {
        if (!activeRef.current) {
          return;
        }

        subscriptionsPush({ type: RTEvent.MOUSE, payload: { ...position, zoom, action: 'mouseMove', rootId } });
      }, SAMPLE_INTERVAL),
    [rootId, subscriptionsPush, zoom]
  );

  const processFrame = useCallback(() => {
    rafIdRef.current = null;
    if (!tracking || !activeRef.current || !lastEventRef.current) {
      return;
    }

    const resolved = readCursorAnchor(lastEventRef.current, { selector, previous: anchorRef.current, scale: zoom });
    if (!resolved) {
      return;
    }

    anchorRef.current = resolved.anchorDOM;
    throttledSend(resolved.position);
  }, [selector, throttledSend, tracking, zoom]);

  const bind = useCallback(() => {
    if (!tracking) {
      return {};
    }

    return {
      onPointerEnter() {
        activeRef.current = true;
        subscriptionsPush({ type: RTEvent.MOUSE, payload: { action: 'mouseEnter', rootId } });
      },
      onPointerLeave() {
        leave();
      },
      onPointerMove(e: React.PointerEvent) {
        // Also arms the tracking: a canvas that mounts with the pointer already inside never gets an enter.
        activeRef.current = true;
        lastEventRef.current = e.nativeEvent;

        if (rafIdRef.current == null) {
          rafIdRef.current = requestAnimationFrame(processFrame);
        }
      }
    };
  }, [leave, processFrame, rootId, subscriptionsPush, tracking]);

  useEffect(() => {
    if (!tracking) {
      return;
    }

    // Switching tab or window fires no pointer event, so without this the peers keep a cursor that is not there.
    const onVisibility = () => {
      if (document.hidden) {
        leave();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);

    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [leave, tracking]);

  useEffect(() => {
    if (!tracking) {
      return;
    }

    // Navigating away unmounts the canvas with the pointer still on it — again no pointer event. The cleanup
    // closes over the root it was mounted with, which is exactly the one being left.
    return () => leave();
  }, [leave, tracking]);

  return { bind };
};

export default useCollaboratorCursor;
