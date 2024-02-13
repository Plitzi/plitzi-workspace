// Packages
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Relatives
import NodeDraggable from './NodeDraggable';
import NodeConnector from './nodes/NodeConnector';
import WorkflowContext from '../WorkflowContext';
import NodeConnectorSpot from './NodeConnectorSpot';
import NodeHeader from './NodeHeader';
import NodeBody from './NodeBody';
import { emptyObject } from '../../../helpers/utils';

const WorkflowNode = props => {
  const {
    className = '',
    id = '',
    type = 'trigger',
    action = '',
    elementId = '',
    position = emptyObject,
    connectors = emptyObject,
    params = emptyObject,
    onSelect = noop,
    ...otherProps
  } = props;
  const [selected, setSelected] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const {
    direction,
    unregisterNode,
    updateNodePosition,
    updateNodeConnector,
    updateNode,
    performLayout,
    nodeDefinitions
  } = useContext(WorkflowContext);
  const ref = useRef();

  const handlePositionChanged = useCallback((x, y) => updateNodePosition(id, x, y), [id, updateNodePosition]);

  const handleConnectorChanged = useCallback(
    connector => updateNodeConnector(id, connector),
    [id, updateNodeConnector]
  );

  const handleChange = useCallback((data = {}) => updateNode({ id, ...data }), [id, updateNode]);

  const handleClickRemove = useCallback(() => unregisterNode(id), [id, unregisterNode]);

  const handleClickSelected = useCallback(() => {
    setSelected(state => !state);
    onSelect(id);
  }, [id, onSelect]);

  const init = useRef(false);
  useEffect(() => {
    if (!init.current) {
      init.current = true;

      return;
    }

    if (type !== 'connector' && init.current) {
      const { width, height } = ref.current?.getBoundingClientRect() ?? { width: 0, height: 0 };
      setSize(state => {
        if (state.width === width && state.height === height) {
          return state;
        }

        return { width, height };
      });
      performLayout(direction);
    }
  }, [selected, type, params]);

  useEffect(() => {
    if (type !== 'connector') {
      const { width, height } = ref.current?.getBoundingClientRect() ?? { width: 0, height: 0 };
      setSize(state => {
        if (state.width === width && state.height === height) {
          return state;
        }

        return { width, height };
      });
    }
  }, []);

  const nodeDefinition = useMemo(
    () => nodeDefinitions.find(n => n.type === type && n.elementId === elementId && n.action === action),
    [nodeDefinitions, type, elementId, action]
  );

  return (
    <>
      {(type === 'trigger' || type === 'callback') && (
        <NodeDraggable
          className={classNames({ 'z-10': !selected, 'z-30 min-h-[200px]': selected }, className)}
          updateOnDragging
          x={position.x}
          y={position.y}
          onPositionChanged={handlePositionChanged}
        >
          <div
            ref={ref}
            id={id}
            className={classNames('flex flex-col rounded-xl bg-white relative w-[250px]', className, {
              'border-solid border border-gray-300': !selected,
              'border-dashed border-2 border-blue-300': selected
            })}
          >
            <div className={classNames('flex w-full')}>
              <NodeHeader
                type={type}
                action={action}
                elementId={elementId}
                onChange={handleChange}
                onClickSelect={handleClickSelected}
                onRemove={handleClickRemove}
              />
            </div>
            {selected && <NodeBody paramDefinitions={nodeDefinition?.params} params={params} onChange={handleChange} />}

            {Object.values(connectors).map((connector, i) => {
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

WorkflowNode.propTypes = {
  className: PropTypes.string,
  id: PropTypes.string,
  type: PropTypes.oneOf(['trigger', 'callback', 'connector']),
  action: PropTypes.string,
  elementId: PropTypes.string,
  position: PropTypes.object,
  connectors: PropTypes.object,
  params: PropTypes.object,
  onSelect: PropTypes.func
};

export default WorkflowNode;
