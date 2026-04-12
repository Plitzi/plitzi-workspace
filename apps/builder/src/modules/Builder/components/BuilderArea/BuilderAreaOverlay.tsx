import { useCallback, useLayoutEffect, useMemo, useState } from 'react';

import { createStoreHook } from '@plitzi/sdk-shared/store';

import BuilderOverlay from '../BuilderOverlay';
import BuilderOverlayDistance from '../BuilderOverlay/BuilderOverlayDistance';
import BuilderOverlayDrag from '../BuilderOverlay/BuilderOverlayDrag';

import type { BuilderState, DisplayMode } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type BuilderAreaOverlayProps = {
  refIframe: RefObject<HTMLIFrameElement | null>;
  baseElementId?: string;
  zoom?: number;
  displayMode?: DisplayMode;
  previewMode?: boolean;
};

const BuilderAreaOverlay = ({
  refIframe,
  baseElementId = '',
  previewMode = false,
  zoom = 1,
  displayMode = 'desktop'
}: BuilderAreaOverlayProps) => {
  const { useStore } = createStoreHook<BuilderState>();
  const [[elementHovered, elementSelected]] = useStore(['elementHovered', 'elementSelected']);
  const [showDistance, setShowDistance] = useState(false);

  const overlaySelectMemo = useMemo(
    () => (
      <BuilderOverlay
        id={elementSelected}
        baseElementId={baseElementId}
        mode="select"
        refIframe={refIframe}
        displayMode={displayMode}
        zoom={zoom}
      />
    ),
    [elementSelected, baseElementId, refIframe, displayMode, zoom]
  );

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'Alt': {
        setShowDistance(true);
        break;
      }

      default:
        break;
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'Alt': {
        setShowDistance(false);

        break;
      }
      default:
    }
  }, []);

  useLayoutEffect(() => {
    if (previewMode) {
      return;
    }

    window.document.addEventListener('keydown', handleKeyDown);
    window.document.addEventListener('keyup', handleKeyUp);
    const iframeDOM = refIframe.current;
    if (iframeDOM && iframeDOM.contentWindow) {
      iframeDOM.contentWindow.document.addEventListener('keydown', handleKeyDown);
      iframeDOM.contentWindow.document.addEventListener('keyup', handleKeyUp);
    }

    return () => {
      window.document.removeEventListener('keydown', handleKeyDown);
      window.document.removeEventListener('keyup', handleKeyUp);
      if (iframeDOM && iframeDOM.contentWindow) {
        iframeDOM.contentWindow.document.removeEventListener('keydown', handleKeyDown);
        iframeDOM.contentWindow.document.removeEventListener('keyup', handleKeyUp);
      }
    };
  }, [previewMode, handleKeyDown, handleKeyUp, refIframe]);

  return (
    <>
      {!showDistance && elementHovered && elementHovered !== elementSelected && (
        <BuilderOverlay
          id={elementHovered}
          baseElementId={baseElementId}
          hideActions
          refIframe={refIframe}
          displayMode={displayMode}
          zoom={zoom}
        />
      )}
      {!showDistance && elementSelected && overlaySelectMemo}
      <BuilderOverlayDrag refIframe={refIframe} zoom={zoom} />
      {showDistance && elementSelected && elementHovered && elementHovered !== elementSelected && (
        <BuilderOverlayDistance
          baseElementId={baseElementId}
          refIframe={refIframe}
          zoom={zoom}
          elementHovered={elementHovered}
          elementSelected={elementSelected}
        />
      )}
    </>
  );
};

export default BuilderAreaOverlay;
