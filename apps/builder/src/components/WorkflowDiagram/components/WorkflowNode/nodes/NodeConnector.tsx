import useDidUpdateEffect from '@plitzi/plitzi-ui/hooks/useDidUpdateEffect';
import get from 'lodash/get';
import { useCallback, use, useMemo, useState } from 'react';

import WorkflowContext from '../../../WorkflowContext';
import Arrow from '../../Arrow';

import type { Node, NodeConnection } from '../../../WorkflowContext';

export type NodeConnectorProps = {
  className?: string;
  id?: string;
  from?: NodeConnection['from'];
  to?: NodeConnection['to'];
};

const NodeConnector = ({ className = '', id = '', from, to }: NodeConnectorProps) => {
  const { direction, connectionLineType, getNode, unregisterNode } = use(WorkflowContext);
  const [fromNode, setFromNode] = useState<Node | undefined>(() => getNode(from?.id ?? ''));
  const [toNode, setToNode] = useState<Node | undefined>(() => getNode(to?.id ?? ''));

  const handleDoubleClick = useCallback(() => {
    unregisterNode(id);
  }, [id, unregisterNode]);

  useDidUpdateEffect(() => {
    if (from) {
      setFromNode(getNode(from.id));
    }

    if (to) {
      setToNode(getNode(to.id));
    }
  }, [getNode, from, to]);

  const fromPosition = useMemo(() => {
    if (!fromNode) {
      return { x: 0, Y: 0 };
    }

    const parentPosition = get(fromNode, 'position', { x: 0, y: 0 });
    const connector = from ? get(fromNode, `connectors.${from.connector}.position`, { x: 0, y: 0 }) : { x: 0, y: 0 };

    return { x: parentPosition.x + connector.x, y: parentPosition.y + connector.y };
  }, [from, fromNode]);

  const toPosition = useMemo(() => {
    if (!toNode) {
      return { x: 0, Y: 0 };
    }

    const parentPosition = get(toNode, 'position', { x: 0, y: 0 });
    const connector = to ? get(toNode, `connectors.${to.connector}.position`, { x: 0, y: 0 }) : { x: 0, y: 0 };

    return { x: parentPosition.x + connector.x, y: parentPosition.y + connector.y };
  }, [to, toNode]);

  return (
    <Arrow
      className={className}
      direction={direction}
      type={connectionLineType}
      fromX={fromPosition.x}
      fromY={fromPosition.y}
      toX={toPosition.x}
      toY={toPosition.y}
      onDoubleClick={handleDoubleClick}
    />
  );
};

export default NodeConnector;
