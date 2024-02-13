// Packages
import React, { useContext } from 'react';
import PropTypes from 'prop-types';

// Relatives
import BuilderOverlay from '../BuilderOverlay';
import BuilderOverlayDrag from '../BuilderOverlay/BuilderOverlayDrag';
import BuilderSelectedContext from '../../contexts/BuilderSelectedContext';
import BuilderHoveredContext from '../../contexts/BuilderHoveredContext';

const BuilderAreaOverlay = props => {
  const { iframeDOM, baseElementId = '', dragTree = false, zoom = 1, displayMode = 'desktop' } = props;
  const { elementHovered } = useContext(BuilderHoveredContext);
  const { elementSelected } = useContext(BuilderSelectedContext);

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
      {elementSelected && (
        <BuilderOverlay
          id={elementSelected}
          baseElementId={baseElementId}
          mode="select"
          iframeDOM={iframeDOM}
          displayMode={displayMode}
          zoom={zoom}
        />
      )}
      {!dragTree && <BuilderOverlayDrag iframeDOM={iframeDOM} zoom={zoom} />}
    </>
  );
};

BuilderAreaOverlay.propTypes = {
  iframeDOM: PropTypes.object,
  dragTree: PropTypes.bool,
  baseElementId: PropTypes.string,
  displayMode: PropTypes.oneOf(['desktop', 'tablet', 'mobile']),
  zoom: PropTypes.number
};

export default BuilderAreaOverlay;
