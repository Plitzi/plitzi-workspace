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
      {/* <BuilderOverlayDistance
        baseElementId={baseElementId}
        iframeDOM={iframeDOM}
        zoom={zoom}
        elementHovered="6724b16f4daa35fd532e75df"
        elementSelected="67220a59b29a2873a7370b41"
      />
      <BuilderOverlayDistance
        baseElementId={baseElementId}
        iframeDOM={iframeDOM}
        zoom={zoom}
        elementHovered="672384168b6e52238b6d5a98"
        elementSelected="67220a59b29a2873a7370b41"
      /> */}

      {/* <BuilderOverlayDistance
        baseElementId={baseElementId}
        iframeDOM={iframeDOM}
        zoom={zoom}
        elementHovered="67220a787004d9496e74dd52"
        elementSelected="67220a80c63afafcd66be45d"
      />
      <BuilderOverlayDistance
        baseElementId={baseElementId}
        iframeDOM={iframeDOM}
        zoom={zoom}
        elementHovered="67220ab18e32c78dc53e8786"
        elementSelected="67220a80c63afafcd66be45d"
      />
      <BuilderOverlayDistance
        baseElementId={baseElementId}
        iframeDOM={iframeDOM}
        zoom={zoom}
        elementHovered="67220a6d49d302012a3137a7"
        elementSelected="67220a80c63afafcd66be45d"
      />
      <BuilderOverlayDistance
        baseElementId={baseElementId}
        iframeDOM={iframeDOM}
        zoom={zoom}
        elementHovered="67220ab92f3152ed411539f8"
        elementSelected="67220a80c63afafcd66be45d"
      /> */}
      {/* <BuilderOverlayDistance
        baseElementId={baseElementId}
        iframeDOM={iframeDOM}
        zoom={zoom}
        elementHovered="6724d1597cfb3f39c6f02967"
        elementSelected="67220a59b29a2873a7370b41"
      /> */}
    </>
  );
};

export default BuilderAreaOverlay;
