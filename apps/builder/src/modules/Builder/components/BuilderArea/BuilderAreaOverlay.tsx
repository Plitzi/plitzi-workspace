import { use, useCallback, useLayoutEffect, useMemo, useState } from 'react';

import BuilderHoveredContext from '@plitzi/sdk-shared/builder/contexts/BuilderHoveredContext';
import BuilderSelectedContext from '@plitzi/sdk-shared/builder/contexts/BuilderSelectedContext';

import BuilderOverlay from '../BuilderOverlay';
import BuilderOverlayDistance from '../BuilderOverlay/BuilderOverlayDistance';
import BuilderOverlayDrag from '../BuilderOverlay/BuilderOverlayDrag';

export type BuilderAreaOverlayProps = {
  iframeDOM?: HTMLIFrameElement | null;
  baseElementId?: string;
  dragTree?: boolean;
  zoom?: number;
  displayMode?: 'desktop' | 'tablet' | 'mobile';
  previewMode?: boolean;
};

const BuilderAreaOverlay = ({
  iframeDOM,
  baseElementId = '',
  previewMode = false,
  dragTree = false,
  zoom = 1,
  displayMode = 'desktop'
}: BuilderAreaOverlayProps) => {
  const { elementHovered } = use(BuilderHoveredContext);
  const { elementSelected } = use(BuilderSelectedContext);
  const [showDistance, setShowDistance] = useState(false);

  const overlaySelectMemo = useMemo(
    () => (
      <BuilderOverlay
        id={elementSelected}
        baseElementId={baseElementId}
        mode="select"
        iframeDOM={iframeDOM}
        displayMode={displayMode}
        zoom={zoom}
      />
    ),
    [elementSelected, baseElementId, iframeDOM, displayMode, zoom]
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
  }, [previewMode, handleKeyDown, handleKeyUp, iframeDOM]);

  return (
    <>
      {!showDistance && elementHovered && elementHovered !== elementSelected && (
        <BuilderOverlay
          id={elementHovered}
          baseElementId={baseElementId}
          hideActions
          iframeDOM={iframeDOM}
          displayMode={displayMode}
          zoom={zoom}
        />
      )}
      {!showDistance && elementSelected && overlaySelectMemo}
      {!dragTree && <BuilderOverlayDrag iframeDOM={iframeDOM} zoom={zoom} />}
      {showDistance && elementSelected && elementHovered && elementHovered !== elementSelected && (
        <BuilderOverlayDistance
          baseElementId={baseElementId}
          iframeDOM={iframeDOM}
          zoom={zoom}
          elementHovered={elementHovered}
          elementSelected={elementSelected}
        />
      )}
    </>
  );
};

export default BuilderAreaOverlay;
