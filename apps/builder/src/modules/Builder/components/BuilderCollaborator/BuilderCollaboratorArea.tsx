import { memo, use, useCallback, useEffect, useRef, useState } from 'react';

import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';

import BuilderCollaboratorCursor from './BuilderCollaboratorCursor';
import BuilderOverlay from '../BuilderOverlay';

import type { DisplayMode } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type BuilderCollaboratorAreaProps = {
  baseElementId?: string;
  instanceId?: string;
  color?: string;
  title?: string;
  refIframe: RefObject<HTMLIFrameElement | null>;
  scale?: number;
  zoom?: number;
  displayMode?: DisplayMode;
};

const BuilderCollaboratorArea = ({
  baseElementId = '',
  instanceId = '',
  color = '#000',
  title = '',
  refIframe,
  scale = 1,
  zoom = 1,
  displayMode = 'desktop'
}: BuilderCollaboratorAreaProps) => {
  const [elementSelected, setElementSelected] = useState<string | undefined>(undefined);
  const [elementHovered, setElementHovered] = useState<string | undefined>(undefined);
  const refCursor = useRef<HTMLDivElement>(null);
  const { supportRealTime, subscriptionsRegisterCallback, subscriptionsUnregisterCallback } =
    use(BuilderSubscriptionsContext);

  const realtimeCallbackMouse = useCallback(
    (payload: {
      action: 'mouseEnter' | 'mouseMove' | 'mouseLeave';
      x: number;
      y: number;
      rootId: string;
      instanceId: string;
    }) => {
      const { action, x, y } = payload;
      if (baseElementId !== payload.rootId || !refCursor.current || payload.instanceId !== instanceId) {
        return;
      }

      switch (action) {
        case 'mouseEnter': {
          refCursor.current.style.display = 'block';

          break;
        }

        case 'mouseMove': {
          refCursor.current.style.left = `${x * (1 / scale)}px`;
          refCursor.current.style.top = `${y * (1 / scale)}px`;

          break;
        }

        case 'mouseLeave': {
          refCursor.current.style.display = 'none';

          break;
        }

        default:
      }
    },
    [baseElementId, instanceId, refCursor, scale]
  );

  const realtimeCallbackElement = useCallback(
    (payload: { action: 'hovered' | 'selected'; id: string; rootId: string; instanceId: string }) => {
      const { action, id, rootId } = payload;
      if (baseElementId !== rootId || payload.instanceId !== instanceId) {
        return;
      }

      switch (action) {
        case 'hovered': {
          setElementHovered(id);

          break;
        }

        case 'selected': {
          setElementSelected(id);

          break;
        }

        default:
      }
    },
    [baseElementId, instanceId]
  );

  useEffect(() => {
    if (supportRealTime) {
      subscriptionsRegisterCallback(instanceId, 'MOUSE', realtimeCallbackMouse);
      subscriptionsRegisterCallback(instanceId, 'ELEMENT', realtimeCallbackElement);
    }

    return () => {
      if (supportRealTime) {
        subscriptionsUnregisterCallback(instanceId, 'MOUSE');
        subscriptionsUnregisterCallback(instanceId, 'ELEMENT');
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
      <BuilderCollaboratorCursor ref={refCursor} color={color} title={title} scale={scale} />
    </div>
  );
};

export default memo(BuilderCollaboratorArea);
