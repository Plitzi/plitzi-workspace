// Packages
import React, { useCallback, use, useEffect, useMemo, useRef, useState } from 'react';
import throttle from 'lodash/throttle';
import get from 'lodash/get';

import BuilderStyleContext from '@plitzi/sdk-shared/builder/contexts/BuilderStyleContext';

// Relatives
import OverlayNormal from './OverlayNormal';
import useBuilderElement from '../../hooks/useBuilderElement';
import { processContainer } from './BuilderOverlayHelper';

/**
 * @param {{
 *   mode?: 'hover' | 'select';
 *   id?: string;
 *   hideActions?: boolean;
 *   displayMode?: 'desktop' | 'tablet' | 'mobile';
 *   baseElementId: string;
 *   iframeDOM: object;
 *   zoom?: number;
 *   isCollaborator?: boolean;
 *   color?: string;
 *   collaboratorName?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const BuilderOverlay = props => {
  const {
    mode = 'hover',
    id = '',
    hideActions = false,
    displayMode = 'desktop',
    baseElementId,
    iframeDOM,
    zoom = 1,
    isCollaborator = false,
    color,
    collaboratorName = ''
  } = props;
  const containerRef = useRef();
  const rootContainerRef = useRef();
  const element = useBuilderElement(id);
  const [container, setContainer] = useState({ width: 0, height: 0, x: 0, y: 0 });
  const [overlayProps, setOverlayProps] = useState({ id: '', element: undefined, elementDOM: undefined });

  const handleProcessContainer = useCallback(
    elementDOM => {
      if (!elementDOM || !rootContainerRef?.current) {
        return;
      }

      const container = processContainer(elementDOM, iframeDOM, zoom);
      if (!container) {
        return;
      }

      const { width, height, x, y } = container;
      rootContainerRef.current.style.width = `${width}px`;
      rootContainerRef.current.style.height = `${height}px`;
      rootContainerRef.current.style.top = `${y}px`;
      rootContainerRef.current.style.left = `${x}px`;
      setContainer(state => {
        if (state.width === width && state.height === height && state.x === x && state.y === y) {
          return state;
        }

        return container;
      });
    },
    [iframeDOM, zoom]
  );

  const throttledHandleProcessContainer = useCallback(throttle(handleProcessContainer, 50), [handleProcessContainer]);

  const getElementDOM = useCallback(
    eId => {
      if (iframeDOM) {
        return iframeDOM.contentWindow.document.querySelector(`[data-id="${eId}"][data-root-id="${baseElementId}"]`);
      }

      return window.document.querySelector(`[data-id="${eId}"][data-root-id="${baseElementId}"]`);
    },
    [iframeDOM, baseElementId]
  );

  useEffect(() => {
    const elementDOM = getElementDOM(id);
    setOverlayProps(state => {
      if (state.id === id && state?.element?.definition?.parentId === element?.definition?.parentId) {
        return state;
      }

      return { id, element, elementDOM };
    });
  }, [baseElementId, element?.definition?.parentId, id, getElementDOM]);

  useEffect(() => {
    if (!overlayProps || !overlayProps.elementDOM) {
      return;
    }

    handleProcessContainer(overlayProps.elementDOM);
  }, [overlayProps]);

  useEffect(() => {
    const { elementDOM } = overlayProps;
    if (!elementDOM || mode !== 'select') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => handleProcessContainer(elementDOM));
    resizeObserver.observe(elementDOM);
    if (elementDOM?.parentNode) {
      resizeObserver.observe(elementDOM?.parentNode);
    }

    const mutationObserver = new MutationObserver(() => handleProcessContainer(overlayProps?.elementDOM));
    if (elementDOM?.parentNode) {
      mutationObserver.observe(elementDOM?.parentNode, { childList: true });
    }

    const scrollCallback = () => throttledHandleProcessContainer(overlayProps?.elementDOM);
    if (iframeDOM) {
      iframeDOM.contentWindow.document.addEventListener('scroll', scrollCallback, true);
      iframeDOM.contentWindow.addEventListener('resize', scrollCallback, true);
    }

    return () => {
      resizeObserver.unobserve(elementDOM);
      if (elementDOM?.parentNode) {
        resizeObserver.unobserve(elementDOM?.parentNode);
      }

      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (iframeDOM) {
        iframeDOM?.contentWindow?.document?.removeEventListener('scroll', scrollCallback, true);
        iframeDOM?.contentWindow?.removeEventListener('resize', scrollCallback, true);
      }
    };
  }, [mode, overlayProps?.elementDOM, overlayProps?.elementDOM?.parentNode, handleProcessContainer]);

  const { style, selectorSelected } = use(BuilderStyleContext);
  const elementStyle = useMemo(() => {
    if (!selectorSelected?.name) {
      return {};
    }

    return get(style, `platform.${displayMode}.${selectorSelected?.name}.attributes`, {});
  }, [style, displayMode, selectorSelected?.name]);

  useEffect(() => {
    if (mode !== 'select') {
      return;
    }

    handleProcessContainer(overlayProps?.elementDOM);
  }, [
    mode,
    elementStyle['margin-top'],
    elementStyle['margin-bottom'],
    elementStyle['margin-left'],
    elementStyle['margin-right'],
    elementStyle['padding-top'],
    elementStyle['padding-bottom'],
    elementStyle['padding-left'],
    elementStyle['padding-right'],
    elementStyle['border-top-width'],
    elementStyle['border-bottom-width'],
    elementStyle['border-left-width'],
    elementStyle['border-right-width']
  ]);

  useEffect(() => {
    if (!overlayProps?.element || overlayProps?.elementDOM || mode !== 'select') {
      return;
    }

    // Special case where the element is not found in the DOM due lazy loading
    let retries = 10;
    const retryHandler = setTimeout(() => {
      const elementDOM = getElementDOM(id);
      if (elementDOM) {
        setOverlayProps({ id, element, elementDOM });
        handleProcessContainer(elementDOM);
        clearInterval(retryHandler);

        return;
      }

      retries -= 1;
      if (retries === 0) {
        clearTimeout(retryHandler);
      }
    }, 125);

    return () => {
      clearTimeout(retryHandler);
    };
  }, [id, overlayProps?.element, overlayProps?.elementDOM, getElementDOM]);

  const selector = useMemo(() => {
    if (mode === 'hover') {
      return '';
    }

    return selectorSelected?.name;
  }, [mode, selectorSelected?.name]);

  if (!overlayProps?.element || !overlayProps?.elementDOM) {
    return undefined;
  }

  return (
    <div ref={rootContainerRef} className={`plitzi-component--overlay-${mode}`}>
      {container && container.width !== 0 && container.height !== 0 && (
        <OverlayNormal
          ref={containerRef}
          iframeDOM={iframeDOM}
          displayMode={displayMode}
          container={container}
          zoom={zoom}
          hideActions={hideActions}
          isCollaborator={isCollaborator}
          color={color}
          collaboratorName={collaboratorName}
          mode={mode}
          selector={selector}
          {...overlayProps}
        />
      )}
    </div>
  );
};

export default BuilderOverlay;
