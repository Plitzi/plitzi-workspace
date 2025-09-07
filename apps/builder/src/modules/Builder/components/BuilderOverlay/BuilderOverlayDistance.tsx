import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { calculateDistances, processContainerDistance } from './BuilderOverlayHelper';

import type { OverlayDistanceRect } from './BuilderOverlayHelper';
import type { Element } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type BuilderOverlayDistanceProps = {
  refIframe?: RefObject<HTMLIFrameElement | null>;
  baseElementId?: Element['id'];
  elementSelected?: Element['id'];
  elementHovered?: Element['id'];
  zoom?: number;
};

const BuilderOverlayDistance = ({
  refIframe,
  baseElementId = '',
  zoom = 1.0,
  elementSelected = '',
  elementHovered = ''
}: BuilderOverlayDistanceProps) => {
  const containerSelectedRef = useRef<HTMLDivElement | null>(null);
  const containerHoveredRef = useRef<HTMLDivElement | null>(null);
  const [containers, setContainers] = useState<Record<string, OverlayDistanceRect>>({});

  const getElementDOM = useCallback(
    (eId: string): HTMLElement | null => {
      if (refIframe?.current && refIframe.current.contentWindow) {
        return refIframe.current.contentWindow.document.querySelector(
          `[data-id="${eId}"][data-root-id="${baseElementId}"]`
        );
      }

      return window.document.querySelector(`[data-id="${eId}"][data-root-id="${baseElementId}"]`);
    },
    [refIframe, baseElementId]
  );

  const handleProcessContainer = useCallback(
    (elementDOM: HTMLElement | null, node: 'selected' | 'hovered', ref: RefObject<HTMLDivElement | null>) => {
      const container = processContainerDistance(elementDOM, refIframe?.current, zoom);
      if (!container) {
        return;
      }

      const { width, height, top, left } = container;
      if (ref.current) {
        ref.current.style.width = `${width}px`;
        ref.current.style.height = `${height}px`;
        ref.current.style.top = `${top}px`;
        ref.current.style.left = `${left}px`;
      }

      setContainers(state => ({ ...state, [node]: container }));
    },
    [refIframe, zoom]
  );

  useEffect(() => {
    handleProcessContainer(getElementDOM(elementSelected), 'selected', containerSelectedRef);
  }, [elementSelected, getElementDOM, handleProcessContainer]);

  useEffect(() => {
    handleProcessContainer(getElementDOM(elementHovered), 'hovered', containerHoveredRef);
  }, [elementHovered, getElementDOM, handleProcessContainer]);

  const { distances, projections } = useMemo(
    () => calculateDistances(containers.selected, containers.hovered),
    [containers]
  );

  return (
    <div className="plitzi-component--overlay-distance">
      <div ref={containerSelectedRef} className="plitzi-component--overlay-distance-selected" />
      <div ref={containerHoveredRef} className="plitzi-component--overlay-distance-hovered" />
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
