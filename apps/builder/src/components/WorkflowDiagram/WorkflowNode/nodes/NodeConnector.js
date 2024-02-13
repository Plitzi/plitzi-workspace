// Packages
import React, { useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';

// Relatives
import Arrow from '../../Arrow';
import WorkflowContext from '../../WorkflowContext';

const NodeConnector = props => {
  const { className = '', id = '', from, to, offsetX = 0, offsetY = 0 } = props;
  const [fromNode, setFromNode] = useState(from);
  const [toNode, setToNode] = useState(to);
  const { direction, getNode, unregisterNode } = useContext(WorkflowContext);

  const handleDoubleClick = useCallback(() => {
    unregisterNode(id);
  }, [id, unregisterNode]);

  useLayoutEffect(() => {
    setFromNode(getNode(from?.id));
    setToNode(getNode(to?.id));
  }, [getNode, from, to]);

  const fromPosition = useMemo(() => {
    if (!fromNode) {
      return { x: 0, Y: 0 };
    }

    const parentPosition = get(fromNode, 'position', { x: 0, y: 0 });
    const connector = get(fromNode, `connectors.${from.connector}.position`, { x: 0, y: 0 });

    return { x: parentPosition.x + connector.x, y: parentPosition.y + connector.y };
  }, [from, fromNode]);

  const toPosition = useMemo(() => {
    if (!toNode) {
      return { x: 0, Y: 0 };
    }

    const parentPosition = get(toNode, 'position', { x: 0, y: 0 });
    const connector = get(toNode, `connectors.${to.connector}.position`, { x: 0, y: 0 });

    return { x: parentPosition.x + connector.x, y: parentPosition.y + connector.y };
  }, [to, toNode]);

  return (
    <Arrow
      className={className}
      direction={direction}
      fromX={fromPosition?.x}
      fromY={fromPosition?.y}
      toX={toPosition?.x}
      toY={toPosition?.y}
      offsetX={offsetX}
      offsetY={offsetY}
      onDoubleClick={handleDoubleClick}
    />
  );
};

NodeConnector.propTypes = {
  id: PropTypes.string,
  className: PropTypes.string,
  from: PropTypes.object,
  to: PropTypes.object,
  offsetX: PropTypes.number,
  offsetY: PropTypes.number
};

export default NodeConnector;
