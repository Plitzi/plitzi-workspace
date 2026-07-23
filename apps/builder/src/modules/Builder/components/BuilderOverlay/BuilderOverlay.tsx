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

  const positionRoot = useCallback(
    (elementDOM?: HTMLElement | null) => {
      if (!elementDOM || !rootContainerRef.current) {
        return undefined;
      }

      const container = processContainer(elementDOM, refIframe.current, zoom);
      if (!container) {
        return undefined;
      }

      const { width, height, x, y } = container;
      rootContainerRef.current.style.width = `${width}px`;
      rootContainerRef.current.style.height = `${height}px`;
      rootContainerRef.current.style.top = `${y}px`;
      rootContainerRef.current.style.left = `${x}px`;

      return container;
    },
    [refIframe, zoom]
  );

  const handleProcessContainer = useCallback(
    (elementDOM?: HTMLElement | null) => {
      const container = positionRoot(elementDOM);
      if (!container) {
        return;
      }

      const { width, height, x, y } = container;
      setContainer(state => {
        if (state.width === width && state.height === height && state.x === x && state.y === y) {
          return state;
        }

        return container;
      });
    },
    [positionRoot]
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

    const targetWindow = refIframe.current?.contentWindow ?? window;
    const targetDocument = targetWindow.document;
    const parent = elementDOM.parentNode as HTMLElement | null;
    const reposition = () => handleProcessContainer(elementDOM);

    const resizeObserver = new ResizeObserver(reposition);
    resizeObserver.observe(elementDOM);
    const mutationObserver = new MutationObserver(reposition);
    if (parent) {
      resizeObserver.observe(parent);
      mutationObserver.observe(parent, { childList: true });
    }

    const scrollCallback = () => throttledHandleProcessContainer(elementDOM);
    targetDocument.addEventListener('scroll', scrollCallback, true);
    targetWindow.addEventListener('resize', scrollCallback, true);

    // CSS animations/transitions move the element without triggering the observers
    // above, so run a rAF loop that repositions each frame while any are active.
    // While animating we only move the root imperatively (children follow via CSS,
    // no React re-render); once it settles we do one full sync to refresh state.
    let activeAnimations = 0;
    let rafId = 0;
    const tick = () => {
      if (activeAnimations > 0) {
        positionRoot(elementDOM);
        rafId = targetWindow.requestAnimationFrame(tick);
      } else {
        reposition();
        rafId = 0;
      }
    };

    const onAnimationStart = () => {
      activeAnimations += 1;
      if (!rafId) {
        rafId = targetWindow.requestAnimationFrame(tick);
      }
    };

    const onAnimationEnd = () => {
      activeAnimations = Math.max(0, activeAnimations - 1);
    };

    targetDocument.addEventListener('animationstart', onAnimationStart, true);
    targetDocument.addEventListener('transitionrun', onAnimationStart, true);
    targetDocument.addEventListener('animationend', onAnimationEnd, true);
    targetDocument.addEventListener('animationcancel', onAnimationEnd, true);
    targetDocument.addEventListener('transitionend', onAnimationEnd, true);
    targetDocument.addEventListener('transitioncancel', onAnimationEnd, true);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (rafId) {
        targetWindow.cancelAnimationFrame(rafId);
      }

      targetDocument.removeEventListener('scroll', scrollCallback, true);
      targetWindow.removeEventListener('resize', scrollCallback, true);
      targetDocument.removeEventListener('animationstart', onAnimationStart, true);
      targetDocument.removeEventListener('transitionrun', onAnimationStart, true);
      targetDocument.removeEventListener('animationend', onAnimationEnd, true);
      targetDocument.removeEventListener('animationcancel', onAnimationEnd, true);
      targetDocument.removeEventListener('transitionend', onAnimationEnd, true);
      targetDocument.removeEventListener('transitioncancel', onAnimationEnd, true);
    };
  }, [mode, overlayProps.elementDOM, refIframe, handleProcessContainer, positionRoot, throttledHandleProcessContainer]);

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
    const retryHandler = setInterval(() => {
      const elementDOM = getElementDOM(id) as HTMLElement | null;
      if (elementDOM) {
        setOverlayProps({ id, element, elementDOM });
        handleProcessContainer(elementDOM);
        clearInterval(retryHandler);

        return;
      }

      retries -= 1;
      if (retries === 0) {
        clearInterval(retryHandler);
      }
    }, 125);

    return () => {
      clearInterval(retryHandler);
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
