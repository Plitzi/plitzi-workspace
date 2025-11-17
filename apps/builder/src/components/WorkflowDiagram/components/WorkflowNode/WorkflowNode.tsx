import useDidUpdateEffect from '@plitzi/plitzi-ui/hooks/useDidUpdateEffect';
import classNames from 'classnames';
import throttle from 'lodash/throttle';
import { useCallback, use, useEffect, useRef, useState } from 'react';

import NodeActions from './NodeActions';
import NodeConnectorSpot from './NodeConnectorSpot';
import NodeDraggable from './NodeDraggable';
import WorkflowContext from '../../WorkflowContext';
import NodeConnector from './nodes/NodeConnector';

import type { Connector } from '../../WorkflowContext';

export type WorkflowNodeProps = {
  className?: string;
  id?: string;
  type?: 'root' | 'node' | 'connector';
  position?: { x: number; y: number };
  connectors?: Record<string, Connector>;
  params?: object;
};

const WorkflowNode = ({
  className = '',
  id = '',
  type = 'root',
  position,
  connectors,
  ...otherProps
}: WorkflowNodeProps) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { direction, updateNodePosition, updateNodeConnector, performLayout, unregisterNode } = use(WorkflowContext);
  const ref = useRef<HTMLDivElement | null>(null);

  const handlePositionChanged = useCallback(
    (x: number, y: number) => updateNodePosition(id, x, y),
    [id, updateNodePosition]
  );

  const handleConnectorChanged = useCallback(
    (connector: Connector) => updateNodeConnector(id, connector),
    [id, updateNodeConnector]
  );

  const handleClickRemove = useCallback(() => unregisterNode(id), [id, unregisterNode]);

  useDidUpdateEffect(() => {
    performLayout(direction);
  }, [performLayout, direction]);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    const handleResize = throttle((entries: ResizeObserverEntry[]) => {
      for (const e of entries) {
        const { width, height } = (e.target as HTMLElement).getBoundingClientRect();
        setSize(state => {
          if (state.width === width && state.height === height) {
            return state;
          }

          return { width, height };
        });
      }
    }, 150);

    const observer = new ResizeObserver(handleResize);
    observer.observe(ref.current);

    return () => {
      handleResize.cancel();
      observer.disconnect();
    };
  }, []);

  return (
    <>
      {type !== 'connector' && (
        <NodeDraggable
          className={classNames('z-10 min-h-[200px]', className)}
          updateOnDragging
          x={position?.x}
          y={position?.y}
          onPositionChanged={handlePositionChanged}
        >
          <div
            ref={ref}
            id={id}
            className={classNames(
              'relative flex w-[250px] flex-col rounded-xl border border-solid border-gray-300 bg-white',
              className
            )}
          >
            <div className="flex w-full px-4 pb-4">
              <NodeActions onRemove={handleClickRemove} />
            </div>

            {connectors &&
              Object.values(connectors).map((connector, i) => {
                const { id: connectorId, mode, placement, limit } = connector;

                return (
                  <NodeConnectorSpot
                    key={i}
                    id={connectorId}
                    parentNodeId={id}
                    parentWidth={size.width}
                    parentHeight={size.height}
                    placement={placement}
                    borderWidth={1}
                    mode={mode}
                    limit={limit}
                    onChange={handleConnectorChanged}
                  />
                );
              })}
          </div>
        </NodeDraggable>
      )}
      {type === 'connector' && <NodeConnector id={id} {...otherProps} offsetX={1} offsetY={1} />}
    </>
  );
};

export default WorkflowNode;
