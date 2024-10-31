// Packages
import React, { use, useCallback, useLayoutEffect, useMemo, useState } from 'react';

// Relatives
import BuilderOverlay from '../BuilderOverlay';
import BuilderOverlayDrag from '../BuilderOverlay/BuilderOverlayDrag';
import BuilderSelectedContext from '../../contexts/BuilderSelectedContext';
import BuilderHoveredContext from '../../contexts/BuilderHoveredContext';
import BuilderOverlayDistance from '../BuilderOverlay/BuilderOverlayDistance';

/**
 * @param {{
 *   iframeDOM: object;
 *   baseElementId?: string;
 *   dragTree?: boolean;
 *   zoom?: number;
 *   displayMode?: 'desktop' | 'tablet' | 'mobile';
 *   previewMode?: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const BuilderAreaOverlay = props => {
  const {
    iframeDOM,
    baseElementId = '',
    previewMode = false,
    dragTree = false,
    zoom = 1,
    displayMode = 'desktop'
  } = props;
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
        hideActions={showDistance}
      />
    ),
    [elementSelected, baseElementId, iframeDOM, displayMode, zoom, showDistance]
  );

  const handleKeyDown = useCallback(async e => {
    switch (e.key) {
      case 'Alt': {
        setShowDistance(true);
        break;
      }

      default:
        break;
    }
  }, []);

  const handleKeyUp = useCallback(async e => {
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
    if (iframeDOM) {
      iframeDOM.contentWindow.document.addEventListener('keydown', handleKeyDown);
      iframeDOM.contentWindow.document.addEventListener('keyup', handleKeyUp);
    }

    return () => {
      window.document.removeEventListener('keydown', handleKeyDown);
      window.document.removeEventListener('keyup', handleKeyUp);
      if (iframeDOM) {
        iframeDOM.contentWindow.document.removeEventListener('keydown', handleKeyDown);
        iframeDOM.contentWindow.document.removeEventListener('keyup', handleKeyUp);
      }
    };
  }, [previewMode, handleKeyDown, handleKeyUp, iframeDOM]);

  return (
    <>
      {elementHovered && elementHovered !== elementSelected && (
        <BuilderOverlay
          id={elementHovered}
          baseElementId={baseElementId}
          hideActions
          iframeDOM={iframeDOM}
          displayMode={displayMode}
          zoom={zoom}
        />
      )}
      {elementSelected && overlaySelectMemo}
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
