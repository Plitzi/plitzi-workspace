/* eslint-disable react-hooks/exhaustive-deps */

import { throttle } from '@plitzi/plitzi-ui/helpers';
import { useCallback, use, useEffect, useRef, useState } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import { processContainer } from './BuilderOverlayHelper';
import OverlayNormal from './OverlayNormal';

import type { DisplayMode, Element, EventBridgeEvent } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type BuilderOverlayProps = {
  mode?: 'hover' | 'select';
  id?: string;
  hideActions?: boolean;
  displayMode?: DisplayMode;
  baseElementId: string;
  refIframe: RefObject<HTMLIFrameElement | null>;
  zoom?: number;
  isCollaborator?: boolean;
  color?: string;
  collaboratorName?: string;
};

const BuilderOverlay = ({
  mode = 'hover',
  id = '',
  hideActions = false,
  displayMode = 'desktop',
  baseElementId,
  refIframe,
  zoom = 1,
  isCollaborator = false,
  color,
  collaboratorName = ''
}: BuilderOverlayProps) => {
  const [element = undefined] = useBuilderStore(`schema.flat.${id}`);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootContainerRef = useRef<HTMLDivElement | null>(null);
  const [container, setContainer] = useState({
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    scrollX: 0,
    scrollY: 0,
    innerHeight: 0,
    innerWidth: 0,
    rounded: { width: 0, height: 0 }
  });
  const { eventBridge } = use(EventBridgeContext);
  const [overlayProps, setOverlayProps] = useState<{ id: string; element?: Element; elementDOM?: HTMLElement | null }>({
    id: '',
    element: undefined,
    elementDOM: undefined
  });

  const handleProcessContainer = useCallback(
    (elementDOM?: HTMLElement | null) => {
      if (!elementDOM || !rootContainerRef.current) {
        return;
      }

      const container = processContainer(elementDOM, refIframe.current, zoom);
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
    [refIframe, zoom]
  );

  // eslint-disable-next-line react-hooks/use-memo
  const throttledHandleProcessContainer = useCallback(throttle(handleProcessContainer, 50), [handleProcessContainer]);

  const getElementDOM = useCallback(
    (eId: string) => {
      if (refIframe.current && refIframe.current.contentWindow) {
        return refIframe.current.contentWindow.document.querySelector(
          `[data-id="${eId}"][data-root-id="${baseElementId}"]`
        );
      }

      return window.document.querySelector(`[data-id="${eId}"][data-root-id="${baseElementId}"]`);
    },
    [refIframe, baseElementId]
  );

  useEffect(() => {
    const elementDOM = getElementDOM(id) as HTMLElement | null;
    setOverlayProps(state => {
      if (state.id === id && state.element?.definition.parentId === element?.definition.parentId) {
        return state;
      }

      return { id, element, elementDOM };
    });
  }, [
    baseElementId,
    element?.definition.parentId,
    id,
    getElementDOM,
    element,
    element?.definition.initialState?.visibility
  ]);

  useEffect(() => {
    if (!overlayProps.elementDOM) {
      return;
    }

    handleProcessContainer(overlayProps.elementDOM);
  }, [handleProcessContainer, overlayProps, element?.definition.initialState?.styleVariant]);

  useEffect(() => {
    const { elementDOM } = overlayProps;
    if (!elementDOM || mode !== 'select') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => handleProcessContainer(elementDOM));
    resizeObserver.observe(elementDOM);
    if (elementDOM.parentNode) {
      resizeObserver.observe(elementDOM.parentNode as HTMLElement);
    }

    const mutationObserver = new MutationObserver(() => handleProcessContainer(overlayProps.elementDOM));
    if (elementDOM.parentNode) {
      mutationObserver.observe(elementDOM.parentNode, { childList: true });
    }

    const scrollCallback = () => throttledHandleProcessContainer(overlayProps.elementDOM);
    const iframeDOM = refIframe.current;
    if (iframeDOM && iframeDOM.contentWindow) {
      iframeDOM.contentWindow.document.addEventListener('scroll', scrollCallback, true);
      iframeDOM.contentWindow.addEventListener('resize', scrollCallback, true);
    }

    return () => {
      resizeObserver.unobserve(elementDOM);
      if (elementDOM.parentNode) {
        resizeObserver.unobserve(elementDOM.parentNode as HTMLElement);
      }

      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (iframeDOM && iframeDOM.contentWindow) {
        iframeDOM.contentWindow.document.removeEventListener('scroll', scrollCallback, true);
        iframeDOM.contentWindow.removeEventListener('resize', scrollCallback, true);
      }
    };
  }, [
    mode,
    overlayProps.elementDOM,
    overlayProps.elementDOM?.parentNode,
    handleProcessContainer,
    overlayProps,
    refIframe,
    throttledHandleProcessContainer
  ]);

  useEffect(() => {
    const { elementDOM } = overlayProps;
    if (!elementDOM || mode !== 'select') {
      return undefined;
    }

    const targetDocument = refIframe.current?.contentWindow?.document ?? window.document;
    const targetWindow = refIframe.current?.contentWindow ?? window;

    let activeAnimations = 0;
    let rafId = 0;
    const tick = () => {
      handleProcessContainer(elementDOM);
      if (activeAnimations > 0) {
        rafId = targetWindow.requestAnimationFrame(tick);
      } else {
        rafId = 0;
      }
    };

    const onStart = () => {
      activeAnimations += 1;
      if (!rafId) {
        rafId = targetWindow.requestAnimationFrame(tick);
      }
    };

    const onEnd = () => {
      activeAnimations = Math.max(0, activeAnimations - 1);
    };

    targetDocument.addEventListener('animationstart', onStart, true);
    targetDocument.addEventListener('transitionrun', onStart, true);
    targetDocument.addEventListener('animationend', onEnd, true);
    targetDocument.addEventListener('animationcancel', onEnd, true);
    targetDocument.addEventListener('transitionend', onEnd, true);
    targetDocument.addEventListener('transitioncancel', onEnd, true);

    return () => {
      if (rafId) {
        targetWindow.cancelAnimationFrame(rafId);
      }

      targetDocument.removeEventListener('animationstart', onStart, true);
      targetDocument.removeEventListener('transitionrun', onStart, true);
      targetDocument.removeEventListener('animationend', onEnd, true);
      targetDocument.removeEventListener('animationcancel', onEnd, true);
      targetDocument.removeEventListener('transitionend', onEnd, true);
      targetDocument.removeEventListener('transitioncancel', onEnd, true);
    };
  }, [mode, overlayProps.elementDOM, overlayProps, refIframe, handleProcessContainer]);

  useEffect(() => {
    if (mode !== 'select') {
      return;
    }

    const handler = (events: Record<EventBridgeEvent, unknown>) => {
      for (const event in events) {
        let refresh = false;
        if (event === 'styleAddSelector') {
          const attribute = (events[event] as string[])[3] ?? '';
          refresh =
            attribute.includes('padding') || attribute.includes('margin') || attribute.includes('border') || !attribute;
        } else if (event === 'styleUpdateSelector') {
          const attribute = (events[event] as string[])[2] ?? '';
          refresh =
            attribute.includes('padding') || attribute.includes('margin') || attribute.includes('border') || !attribute;
        }

        if (refresh) {
          handleProcessContainer(overlayProps.elementDOM);
          refresh = false;
        }
      }
    };

    return eventBridge.listen(['styleAddSelector', 'styleUpdateSelector'], handler);
  }, [handleProcessContainer, overlayProps]);

  useEffect(() => {
    if (!overlayProps.element || overlayProps.elementDOM || mode !== 'select') {
      return;
    }

    // Special case where the element is not found in the DOM due lazy loading
    let retries = 10;
    const retryHandler = setTimeout(() => {
      const elementDOM = getElementDOM(id) as HTMLElement | null;
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
  }, [id, overlayProps.element, overlayProps.elementDOM, getElementDOM, mode, element, handleProcessContainer]);

  if (!overlayProps.element || !overlayProps.elementDOM) {
    return undefined;
  }

  return (
    <div ref={rootContainerRef} className={`plitzi-component--overlay-${mode}`}>
      {container.width !== 0 && container.height !== 0 && (
        <OverlayNormal
          ref={containerRef}
          refIframe={refIframe}
          displayMode={displayMode}
          container={container}
          zoom={zoom}
          hideActions={hideActions}
          isCollaborator={isCollaborator}
          color={color}
          collaboratorName={collaboratorName}
          mode={mode}
          {...overlayProps}
        />
      )}
    </div>
  );
};

export default BuilderOverlay;
