import classNames from 'classnames';
import { use, useEffect, useMemo, useRef, useState } from 'react';

import Arrow from '../Arrow';
import { calculatePosition } from '../helpers/workflowUtils';
import WorkflowContext from '../WorkflowContext';

export type NodeConnectorSpotProps = {
  className?: string;
  id: string;
  parentNodeId: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
  mode: 'in' | 'out';
  width?: number;
  height?: number;
  parentWidth: number;
  parentHeight: number;
  step?: number;
  totalSteps?: number;
  borderWidth?: number;
  limit?: number;
  onChange: (arg0: {
    id: string;
    mode: 'in' | 'out';
    placement: 'top' | 'bottom' | 'left' | 'right';
    limit?: number;
    position: { x: number; y: number };
  }) => void;
};

const NodeConnectorSpot = ({
  id = '',
  className = '',
  placement = 'right',
  mode = 'out',
  parentNodeId = '',
  step = 1,
  totalSteps = 1,
  width = 16,
  height = 16,
  parentWidth = 0,
  parentHeight = 0,
  borderWidth = 0,
  limit,
  onChange
}: NodeConnectorSpotProps) => {
  const [dragging, setDragging] = useState(false);
  const [TX, setTX] = useState(0);
  const [TY, setTY] = useState(0);
  const [connPos, setConnPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement | null>(null);
  const { direction, bindNodes } = use(WorkflowContext);
  const posX = useMemo(() => {
    let newPosX = 0;
    const pWidth = parentWidth - borderWidth * 2;
    switch (direction) {
      case 'vertical': {
        switch (placement) {
          case 'right':
          case 'left':
            newPosX = calculatePosition(pWidth, width, step, totalSteps);
            break;

          default:
        }

        break;
      }

      case 'horizontal':
      default: {
        switch (placement) {
          case 'right': {
            newPosX = pWidth;

            break;
          }

          default:
        }
      }
    }

    return newPosX;
  }, [parentWidth, borderWidth, direction, placement, width, step, totalSteps]);
  const posY = useMemo(() => {
    let newPosY = 0;
    const pHeight = parentHeight - borderWidth * 2;
    switch (direction) {
      case 'vertical': {
        switch (placement) {
          case 'right':
            newPosY = pHeight;
            break;

          default:
        }

        break;
      }

      case 'horizontal':
      default: {
        switch (placement) {
          case 'right':
          case 'left':
            newPosY = calculatePosition(pHeight, height, step, totalSteps);
            break;

          default:
        }
      }
    }

    return newPosY;
  }, [parentHeight, borderWidth, direction, placement, height, step, totalSteps]);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove, false);
      window.addEventListener('mouseup', handleMouseUp, false);

      window.addEventListener('touchmove', handleTouchMove, false);
      window.addEventListener('touchend', handleTouchEnd, false);
    }

    return () => {
      if (dragging) {
        window.removeEventListener('mousemove', handleMouseMove, false);
        window.removeEventListener('mouseup', handleMouseUp, false);

        window.removeEventListener('touchmove', handleTouchMove, false);
        window.removeEventListener('touchend', handleTouchEnd, false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  const handleMouseMove = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (dragging) {
      const { clientX, clientY } = e;
      const newX = clientX - TX;
      const newY = clientY - TY;
      setConnPos({ x: newX, y: newY });
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging(false);
    setConnPos({ x: 0, y: 0 });
    const { nodeId, connectorId } = (e.target as HTMLElement).dataset;
    if (!nodeId || !connectorId) {
      return;
    }

    bindNodes(parentNodeId, nodeId, id, connectorId);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (e.button === 0) {
      setDragging(true);
      setTX(e.clientX);
      setTY(e.clientY);
    } else {
      setDragging(false);
      setConnPos({ x: 0, y: 0 });
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    e.stopPropagation();
    if (e.changedTouches.length > 1) {
      e.preventDefault();
    }

    if (dragging) {
      const { clientX, clientY } = e.touches[0];
      const newX = clientX - TX;
      const newY = clientY - TY;
      setConnPos({ x: newX, y: newY });
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    setDragging(false);
    setConnPos({ x: 0, y: 0 });
    const { nodeId, connectorId } = (e.target as HTMLElement).dataset;
    if (!nodeId || !connectorId) {
      return;
    }

    bindNodes(parentNodeId, nodeId, id, connectorId);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    setDragging(true);
    setTX(e.touches[0].clientX);
    setTY(e.touches[0].clientY);
  };

  useEffect(() => {
    onChange({ id, mode, placement, limit, position: { x: posX, y: posY } });
  }, [id, mode, direction, step, totalSteps, limit, posX, posY, onChange, placement]);

  return (
    <div
      ref={ref}
      className={classNames('absolute z-20 flex rounded-full', className, {
        'hover:h-6! hover:w-6!': !dragging,
        'bg-purple-500': mode === 'in',
        'bg-green-500': mode === 'out',
        'translate-x-[-50%] translate-y-[-50%]': placement === 'right' || placement === 'left'
      })}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{ width, height, top: `${posY}px`, left: `${posX}px` }}
      data-node-id={parentNodeId}
      data-connector-id={id}
    >
      {mode === 'out' && dragging && (
        <Arrow
          direction={direction}
          fromX={Math.floor(width / 2)}
          fromY={Math.floor(height / 2)}
          toX={connPos.x}
          toY={connPos.y}
          isPreview
        />
      )}
    </div>
  );
};

export default NodeConnectorSpot;
