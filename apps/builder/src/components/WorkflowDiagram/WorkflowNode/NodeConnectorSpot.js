// Packages
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Relatives
import { calculatePosition } from '../helpers/workflowUtils';
import Arrow from '../Arrow/Arrow';
import WorkflowContext from '../WorkflowContext';

const NodeConnectorSpot = props => {
  const {
    id = '',
    className = '',
    placement = 'right',
    mode = 'out',
    posX: posXProp = 0,
    posY: posYProp = 0,
    parentNodeId = '',
    step = 1,
    totalSteps = 1,
    width = 16,
    height = 16,
    parentWidth = 0,
    parentHeight = 0,
    borderWidth = 0,
    limit,
    onChange = noop
  } = props;
  const [dragging, setDragging] = useState(false);
  const [TX, setTX] = useState(0);
  const [TY, setTY] = useState(0);
  const [connPos, setConnPos] = useState({ x: 0, y: 0 });
  const ref = useRef();
  const { direction, bindNodes } = useContext(WorkflowContext);
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
  }, [posXProp, parentWidth, borderWidth, direction]);
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
  }, [posYProp, parentHeight, borderWidth, direction]);

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
  }, [dragging]);

  const handleMouseMove = e => {
    e.stopPropagation();
    e.preventDefault();
    if (dragging) {
      const { clientX, clientY } = e;
      const newX = clientX - TX;
      const newY = clientY - TY;
      setConnPos({ x: newX, y: newY });
    }
  };

  const handleMouseUp = e => {
    e.stopPropagation();
    e.preventDefault();
    setDragging(false);
    setConnPos({ x: 0, y: 0 });
    const { nodeId, connectorId } = e.target.dataset;
    if (!nodeId || !connectorId) {
      return;
    }

    bindNodes(parentNodeId, nodeId, id, connectorId);
  };

  const handleMouseDown = e => {
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

  const handleTouchMove = e => {
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

  const handleTouchEnd = e => {
    setDragging(false);
    setConnPos({ x: 0, y: 0 });
    const { nodeId, connectorId } = e.target.dataset;
    if (!nodeId || !connectorId) {
      return;
    }

    bindNodes(parentNodeId, nodeId, id, connectorId);
  };

  const handleTouchStart = e => {
    e.stopPropagation();
    setDragging(true);
    setTX(e.touches[0].clientX);
    setTY(e.touches[0].clientY);
  };

  useEffect(() => {
    onChange({ id, mode, placement, limit, position: { x: posX, y: posY } });
  }, [id, mode, direction, step, totalSteps, limit, posX, posY]);

  return (
    <div
      ref={ref}
      className={classNames('flex rounded-full absolute z-20', className, {
        'hover:!w-6 hover:!h-6': !dragging,
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

NodeConnectorSpot.propTypes = {
  className: PropTypes.string,
  id: PropTypes.string,
  parentNodeId: PropTypes.string,
  placement: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
  mode: PropTypes.oneOf(['in', 'out']),
  width: PropTypes.number,
  height: PropTypes.number,
  parentWidth: PropTypes.number,
  parentHeight: PropTypes.number,
  posX: PropTypes.number,
  posY: PropTypes.number,
  step: PropTypes.number,
  totalSteps: PropTypes.number,
  borderWidth: PropTypes.number,
  limit: PropTypes.number,
  onChange: PropTypes.func
};

export default NodeConnectorSpot;
