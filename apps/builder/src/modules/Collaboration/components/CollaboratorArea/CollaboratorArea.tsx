import { memo, use, useCallback, useEffect, useRef, useState } from 'react';

import { RTEvent } from '@plitzi/sdk-shared';
import BuilderOverlay from '@pmodules/Builder/components/BuilderOverlay';
import { resolveCursorPosition, resolveElementState } from '@pmodules/Collaboration/CollaborationHelper';
import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';

import CollaboratorCursor from './CollaboratorCursor';

import type { DisplayMode, RTMessageManagedServer, SubscriptionCollaboratorElementState } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type CollaboratorAreaProps = {
  baseElementId?: string;
  color?: string;
  elementState?: SubscriptionCollaboratorElementState;
  instanceId: string;
  title?: string;
  refIframe: RefObject<HTMLIFrameElement | null>;
  trackingContainerRef: RefObject<HTMLDivElement | null>;
  zoom?: number;
  displayMode?: DisplayMode;
};

/** One collaborator's presence on this canvas: their cursor and the overlays of what they have hovered/selected. */
const CollaboratorArea = ({
  baseElementId = '',
  color = '#000',
  elementState,
  instanceId,
  title = '',
  refIframe,
  trackingContainerRef,
  zoom = 1,
  displayMode = 'desktop'
}: CollaboratorAreaProps) => {
  const [elementSelected, setElementSelected] = useState<string | undefined>(undefined);
  const [elementHovered, setElementHovered] = useState<string | undefined>(undefined);
  const refCursor = useRef<HTMLDivElement>(null);
  const refPositioned = useRef(false);
  const { supportRealTime, subscriptionsRegisterCallback, subscriptionsUnregisterCallback } =
    use(BuilderSubscriptionsContext);

  const realtimeCallbackMouse = useCallback(
    (payload: Extract<RTMessageManagedServer, { type: RTEvent.MOUSE }>['payload']) => {
      // Every collaborator area listens to the same event, so each one keeps only its own collaborator's moves.
      if (payload.instanceId !== instanceId || !refCursor.current) {
        return;
      }

      // The cursor only belongs on the canvas the collaborator is actually pointing at: anything arriving from
      // another root (they moved to another page/layout) hides it here instead of leaving it stuck.
      if (baseElementId !== payload.rootId || payload.action === 'mouseLeave') {
        refCursor.current.style.display = 'none';
        refPositioned.current = false;

        return;
      }

      switch (payload.action) {
        case 'mouseEnter': {
          // Shown on its first resolved position instead of here: revealing it now would park it on the corner
          // until a move arrives, and then glide it across the canvas.
          refPositioned.current = false;

          break;
        }

        case 'mouseMove': {
          const { x, y, dx, dy, anchorId, zoom: collaboratorZoom } = payload;
          const position = resolveCursorPosition(
            { x, y, dx, dy, anchorId },
            {
              rootId: baseElementId,
              containerDOM: trackingContainerRef.current,
              iframeDOM: refIframe.current,
              zoom
            }
          );

          if (!position) {
            break;
          }

          // The first position lands without the CSS transition, so the cursor appears where it belongs instead
          // of sliding in from the canvas origin.
          refCursor.current.style.transition = refPositioned.current ? '' : 'none';
          refCursor.current.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
          if (!refPositioned.current) {
            refPositioned.current = true;
            refCursor.current.style.display = 'flex';
          }

          const usernameDOM = refCursor.current.querySelector('.cursor-username');
          if (usernameDOM) {
            usernameDOM.textContent = `${title}${collaboratorZoom !== 1 ? `(${collaboratorZoom * 100}%)` : ''}`;
          }

          break;
        }

        default:
      }
    },
    [baseElementId, instanceId, refIframe, title, trackingContainerRef, zoom]
  );

  const realtimeCallbackElement = useCallback(
    (payload: Extract<RTMessageManagedServer, { type: RTEvent.ELEMENT }>['payload']) => {
      if (payload.instanceId !== instanceId) {
        return;
      }

      // Same rule as the cursor: what they picked on another page must not stay highlighted on this one.
      if (baseElementId !== payload.rootId) {
        setElementHovered(undefined);
        setElementSelected(undefined);

        return;
      }

      switch (payload.action) {
        case 'hovered': {
          setElementHovered(payload.id);

          break;
        }

        case 'selected': {
          setElementSelected(payload.id);

          break;
        }

        default:
      }
    },
    [baseElementId, instanceId]
  );

  // The snapshot the collaborator carries in the INIT payload: what they had hovered/selected before this
  // client existed, which no live event can deliver anymore.
  useEffect(() => {
    const { hovered, selected } = resolveElementState(elementState, baseElementId);
    setElementHovered(hovered);
    setElementSelected(selected);
  }, [baseElementId, elementState]);

  useEffect(() => {
    if (supportRealTime) {
      subscriptionsRegisterCallback(RTEvent.MOUSE, realtimeCallbackMouse, instanceId);
      subscriptionsRegisterCallback(RTEvent.ELEMENT, realtimeCallbackElement, instanceId);
    }

    return () => {
      if (supportRealTime) {
        subscriptionsUnregisterCallback(RTEvent.MOUSE, instanceId);
        subscriptionsUnregisterCallback(RTEvent.ELEMENT, instanceId);
      }
    };
  }, [
    instanceId,
    realtimeCallbackElement,
    realtimeCallbackMouse,
    subscriptionsRegisterCallback,
    subscriptionsUnregisterCallback,
    supportRealTime
  ]);

  return (
    <div className="builder__collaborator-area">
      {elementSelected && (
        <BuilderOverlay
          refIframe={refIframe}
          id={elementSelected}
          baseElementId={baseElementId}
          mode="select"
          hideActions
          zoom={zoom}
          isCollaborator
          displayMode={displayMode}
          color={color}
          collaboratorName={title}
        />
      )}
      {elementHovered && elementHovered !== elementSelected && (
        <BuilderOverlay
          refIframe={refIframe}
          id={elementHovered}
          baseElementId={baseElementId}
          hideActions
          zoom={zoom}
          isCollaborator
          displayMode={displayMode}
          color={color}
          collaboratorName={title}
        />
      )}
      <CollaboratorCursor ref={refCursor} color={color} title={title} zoom={zoom} />
    </div>
  );
};

export default memo(CollaboratorArea);
