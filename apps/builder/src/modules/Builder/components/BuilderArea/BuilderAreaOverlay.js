// Packages
import React, { useContext, useMemo } from 'react';

// Relatives
import BuilderOverlay from '../BuilderOverlay';
import BuilderOverlayDrag from '../BuilderOverlay/BuilderOverlayDrag';
import BuilderSelectedContext from '../../contexts/BuilderSelectedContext';
import BuilderHoveredContext from '../../contexts/BuilderHoveredContext';

/**
 * @param {{
 *   iframeDOM: object;
 *   baseElementId?: string;
 *   dragTree?: boolean;
 *   zoom?: number;
 *   displayMode?: 'desktop' | 'tablet' | 'mobile';
 * }} props
 * @returns {React.ReactElement}
 */
const BuilderAreaOverlay = props => {
  const { iframeDOM, baseElementId = '', dragTree = false, zoom = 1, displayMode = 'desktop' } = props;
  const { elementHovered } = useContext(BuilderHoveredContext);
  const { elementSelected } = useContext(BuilderSelectedContext);

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
    </>
  );
};

export default BuilderAreaOverlay;
