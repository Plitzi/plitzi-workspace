import { memo, use, useCallback, useEffect, useRef, useState } from 'react';

import { RTEvent } from '@plitzi/sdk-shared';
import useNormalizedCursor from '@pmodules/Builder/hooks/useNormalizedCursor';
import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';

import BuilderCollaboratorCursor from './BuilderCollaboratorCursor';
import BuilderOverlay from '../BuilderOverlay';

import type { DisplayMode, RTMessageManagedServer } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type BuilderCollaboratorAreaProps = {
  baseElementId?: string;
  color?: string;
  title?: string;
  refIframe: RefObject<HTMLIFrameElement | null>;
  trackingContainerRef: RefObject<HTMLDivElement | null>;
  zoom?: number;
  displayMode?: DisplayMode;
};

const BuilderCollaboratorArea = ({
  baseElementId = '',
  color = '#000',
  title = '',
  refIframe,
  trackingContainerRef,
  zoom = 1,
  displayMode = 'desktop'
}: BuilderCollaboratorAreaProps) => {
  const [elementSelected, setElementSelected] = useState<string | undefined>(undefined);
  const [elementHovered, setElementHovered] = useState<string | undefined>(undefined);
  const refCursor = useRef<HTMLDivElement>(null);
  const { supportRealTime, subscriptionsRegisterCallback, subscriptionsUnregisterCallback } =
    use(BuilderSubscriptionsContext);

  const { mapToPixels } = useNormalizedCursor(trackingContainerRef);

  const realtimeCallbackMouse = useCallback(
    (payload: Extract<RTMessageManagedServer, { type: RTEvent.MOUSE }>['payload']) => {
      if (baseElementId !== payload.rootId || !refCursor.current) {
        return;
      }

      switch (payload.action) {
        case 'mouseEnter': {
          refCursor.current.style.display = 'flex';

          break;
        }

        case 'mouseMove': {
          const { x, y, zoom } = payload;
          const w = mapToPixels({ x, y });
          refCursor.current.style.transform = `translate3d(${w?.x}px, ${w?.y}px, 0)`;
          const usernameDOM = refCursor.current.querySelector('.cursor-username');
          if (usernameDOM) {
            usernameDOM.textContent = `${title}${zoom !== 1 ? `(${zoom * 100}%)` : ''}`;
          }

          break;
        }

        case 'mouseLeave': {
          refCursor.current.style.display = 'none';

          break;
        }

        default:
      }
    },
    [baseElementId, mapToPixels, title]
  );

  const realtimeCallbackElement = useCallback(
    (payload: Extract<RTMessageManagedServer, { type: RTEvent.ELEMENT }>['payload']) => {
      if (baseElementId !== payload.rootId) {
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
    [baseElementId]
  );

  useEffect(() => {
    if (supportRealTime) {
      subscriptionsRegisterCallback(RTEvent.MOUSE, realtimeCallbackMouse);
      subscriptionsRegisterCallback(RTEvent.ELEMENT, realtimeCallbackElement);
    }

    return () => {
      if (supportRealTime) {
        subscriptionsUnregisterCallback(RTEvent.MOUSE);
        subscriptionsUnregisterCallback(RTEvent.ELEMENT);
      }
    };
  }, [
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
          id={elementHovered === elementSelected ? undefined : elementHovered}
          baseElementId={baseElementId}
          hideActions
          zoom={zoom}
          isCollaborator
          displayMode={displayMode}
          color={color}
          collaboratorName={title}
        />
      )}
      <BuilderCollaboratorCursor ref={refCursor} color={color} title={title} zoom={zoom} />
    </div>
  );
};

export default memo(BuilderCollaboratorArea);
