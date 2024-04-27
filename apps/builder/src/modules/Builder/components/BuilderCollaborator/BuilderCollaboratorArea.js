// Packages
import React, { memo, useContext, useEffect, useRef, useState } from 'react';

// Alias
import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';
import { RealTimeEventTypes } from '@pmodules/Network/helpers/EventTypes';

// Relatives
import BuilderCollaboratorCursor from './BuilderCollaboratorCursor';
import BuilderOverlay from '../BuilderOverlay';

/**
 * @param {{
 *   baseElementId?: string;
 *   instanceId?: string;
 *   color?: string;
 *   title?: string;
 *   iframeDOM: object;
 *   scale?: number;
 *   zoom?: number;
 *   displayMode?: 'desktop' | 'tablet' | 'mobile';
 * }} props
 * @returns {React.ReactElement}
 */
const BuilderCollaboratorArea = props => {
  const {
    baseElementId = '',
    instanceId = '',
    color = '#000',
    title = '',
    iframeDOM,
    scale = 1,
    zoom = 1,
    displayMode = 'desktop'
  } = props;
  const [elementSelected, setElementSelected] = useState(null);
  const [elementHovered, setElementHovered] = useState(null);
  const refCursor = useRef(null);
  const { supportRealTime, subscriptionsRegisterCallback, subscriptionsUnregisterCallback } =
    useContext(BuilderSubscriptionsContext);

  const realtimeCallbackMouse = payload => {
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
  };

  const realtimeCallbackElement = payload => {
    const { action, id } = payload;
    if (baseElementId !== payload.rootId || payload.instanceId !== instanceId) {
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
  };

  useEffect(() => {
    if (supportRealTime) {
      subscriptionsRegisterCallback(instanceId, RealTimeEventTypes.MOUSE, realtimeCallbackMouse);
      subscriptionsRegisterCallback(instanceId, RealTimeEventTypes.ELEMENT, realtimeCallbackElement);
    }

    return () => {
      if (supportRealTime) {
        subscriptionsUnregisterCallback(instanceId, RealTimeEventTypes.MOUSE);
        subscriptionsUnregisterCallback(instanceId, RealTimeEventTypes.ELEMENT);
      }
    };
  }, []);

  return (
    <div className="builder__collaborator-area">
      {elementSelected && (
        <BuilderOverlay
          iframeDOM={iframeDOM}
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
          iframeDOM={iframeDOM}
          id={elementHovered === elementSelected ? null : elementHovered}
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
