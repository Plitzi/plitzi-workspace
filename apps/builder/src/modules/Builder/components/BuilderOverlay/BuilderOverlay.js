// Packages
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import throttle from 'lodash/throttle';
import get from 'lodash/get';

// Alias
import BuilderStyleContext from '@pmodules/Builder/contexts/BuilderStyleContext';

// Relatives
import OverlayNormal from './OverlayNormal';
import useBuilderElement from '../../hooks/useBuilderElement';
import { processContainer } from './BuilderOverlayHelper';

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

  const getElementDOM = id => {
    if (iframeDOM) {
      return iframeDOM.contentWindow.document.querySelector(`[data-id="${id}"][data-root-id="${baseElementId}"]`);
    }

    return window.document.querySelector(`[data-id="${id}"][data-root-id="${baseElementId}"]`);
  };

  useEffect(() => {
    const elementDOM = getElementDOM(id);
    setOverlayProps(state => (state.id === id ? state : { id, element, elementDOM }));
    handleProcessContainer(elementDOM);
  }, [baseElementId, element, id]);

  useEffect(() => {
    const { elementDOM } = overlayProps;
    if (!elementDOM) {
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
  }, [overlayProps?.elementDOM, overlayProps?.elementDOM?.parentNode, handleProcessContainer]);

  const { style, selectorSelected } = useContext(BuilderStyleContext);
  const elementStyle = useMemo(() => {
    if (!selectorSelected?.name) {
      return {};
    }

    return get(style, `platform.${displayMode}.${selectorSelected?.name}.attributes`, {});
  }, [style, displayMode, selectorSelected?.name]);

  useEffect(() => {
    handleProcessContainer(overlayProps?.elementDOM);
  }, [
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
    if (overlayProps?.element && !overlayProps?.elementDOM && mode === 'select') {
      // Special case where the element is not found in the DOM due lazy loading
      let retries = 8;
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
      }, 250);
    }
  }, [id, overlayProps?.element, overlayProps?.elementDOM]);

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
          selector={selectorSelected?.name}
          {...overlayProps}
        />
      )}
    </div>
  );
};

BuilderOverlay.propTypes = {
  iframeDOM: PropTypes.object,
  id: PropTypes.string,
  mode: PropTypes.oneOf(['hover', 'select']),
  displayMode: PropTypes.oneOf(['desktop', 'tablet', 'mobile']),
  hideActions: PropTypes.bool,
  baseElementId: PropTypes.string,
  zoom: PropTypes.number,
  isCollaborator: PropTypes.bool,
  color: PropTypes.string,
  collaboratorName: PropTypes.string
};

export default BuilderOverlay;
