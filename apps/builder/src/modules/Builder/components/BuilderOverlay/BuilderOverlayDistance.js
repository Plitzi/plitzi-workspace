// Packages
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Relatives
import { calculateDistances, processContainerDistance } from './BuilderOverlayHelper';

/**
 * @param {{
 *   iframeDOM: object;
 *   baseElementId?: string;
 *   elementSelected?: string;
 *   elementHovered?: string;
 *   zoom?: number;
 * }} props
 * @returns {React.ReactElement}
 */
const BuilderOverlayDistance = props => {
  const { iframeDOM, baseElementId = '', zoom = 1.0, elementSelected = '', elementHovered = '' } = props;
  const containerSelectedRef = useRef();
  const containerHoveredRef = useRef();
  const [containers, setContainers] = useState({});

  const getElementDOM = useCallback(
    eId => {
      if (iframeDOM) {
        return iframeDOM.contentWindow.document.querySelector(`[data-id="${eId}"][data-root-id="${baseElementId}"]`);
      }

      return window.document.querySelector(`[data-id="${eId}"][data-root-id="${baseElementId}"]`);
    },
    [iframeDOM, baseElementId]
  );

  const handleProcessContainer = useCallback(
    (elementDOM, node, ref) => {
      const container = processContainerDistance(elementDOM, iframeDOM, zoom);
      if (!container) {
        return;
      }

      const { width, height, top, left } = container;
      if (ref?.current) {
        ref.current.style.width = `${width}px`;
        ref.current.style.height = `${height}px`;
        ref.current.style.top = `${top}px`;
        ref.current.style.left = `${left}px`;
      }

      setContainers(state => ({ ...state, [node]: container }));
    },
    [iframeDOM, zoom]
  );

  useEffect(() => {
    handleProcessContainer(getElementDOM(elementSelected), 'selected', containerSelectedRef);
  }, [elementSelected, getElementDOM, handleProcessContainer]);

  useEffect(() => {
    handleProcessContainer(getElementDOM(elementHovered), 'hovered', containerHoveredRef);
  }, [elementHovered, getElementDOM, handleProcessContainer]);

  const { distances, projections } = useMemo(
    () => calculateDistances(containers?.selected, containers?.hovered),
    [containers]
  );

  return (
    <div className={`plitzi-component--overlay-distance`}>
      <div ref={containerSelectedRef} className={`plitzi-component--overlay-distance-selected`} />
      <div ref={containerHoveredRef} className={`plitzi-component--overlay-distance-hovered`} />
      {distances.map((distance, i) => (
        <div
          key={`${distance.placement}-${i}`}
          className="plitzi-component--overlay-distance-node"
          style={distance.position}
        >
          <div className="overlay-distance-node-value">{distance.value}</div>
        </div>
      ))}
      {projections.map((projection, i) => (
        <div
          key={`${projection.placement}-${i}`}
          className="plitzi-component--overlay-distance-node-projection"
          style={projection.position}
        />
      ))}
    </div>
  );
};

export default BuilderOverlayDistance;
