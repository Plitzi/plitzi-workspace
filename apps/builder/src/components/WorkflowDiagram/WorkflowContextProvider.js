// Packages
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { produce } from 'immer';
import get from 'lodash/get';
import set from 'lodash/set';
import noop from 'lodash/noop';
import debounce from 'lodash/debounce';
import has from 'lodash/has';

// Relatives
import WorkflowContext from './WorkflowContext';
import { generateID } from '../../helpers/utils';

const nodeDefinitionsDefault = [];

/**
 * @param {{
 *   children: React.ReactNode;
 *   template: object;
 *   containerRef: React.RefObject;
 *   direction?: 'horizontal' | 'vertical';
 *   nodeDefinitions?: object[];
 *   addNodePositionX?: number;
 *   addNodePositionY?: number;
 *   onChange?: (template: object) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const WorkflowContextProvider = props => {
  const {
    children,
    template,
    containerRef,
    direction = 'horizontal',
    nodeDefinitions = nodeDefinitionsDefault,
    addNodePositionX = 0,
    addNodePositionY = 0,
    onChange = noop
  } = props;
  const [nodes, setNodes] = useState(() => get(template, 'nodes', {}));
  const onChangeDebounced = useMemo(() => debounce(onChange, 100), [onChange]);
  const init = useRef(false);

  useLayoutEffect(() => {
    if (init.current) {
      init.current = false;
      setNodes(get(template, 'nodes', {}));
    }
  }, [template]);

  useEffect(() => {
    if (!init.current) {
      init.current = true;

      return;
    }

    onChangeDebounced({ ...template, nodes });
  }, [nodes, onChangeDebounced]);

  const registerNode = useCallback(
    node =>
      setNodes(state =>
        produce(state, draft => {
          const { offsetHeight, offsetWidth } = containerRef.current;
          draft[node.id] = node;
          let newX = offsetWidth / 2;
          if (addNodePositionX !== 0) {
            newX = addNodePositionX;
          }

          let newY = offsetHeight / 2;
          if (addNodePositionY !== 0) {
            newY = addNodePositionY;
          }

          set(draft, `${node.id}.position`, { x: newX, y: newY });
        })
      ),
    [containerRef]
  );

  const unregisterNode = useCallback(
    nodeId =>
      setNodes(state =>
        produce(state, draft => {
          // Delete Connections
          Object.values(draft)
            .filter(node => node.type === 'connector' && (node.from.id === nodeId || node.to.id === nodeId))
            .forEach(node => {
              delete draft[node.id];
            });

          // Delete Node
          delete draft[nodeId];
        })
      ),
    []
  );

  const updateNode = useCallback(
    (node, reset = false) =>
      setNodes(state =>
        produce(state, draft => {
          if (!has(draft, node.id)) {
            return;
          }

          const currentNode = get(draft, node.id, {});
          if (node.type) {
            const connectorIn = Object.values(currentNode.connectors).find(connector => connector.mode === 'in');
            const connectorOut = Object.values(currentNode.connectors).find(connector => connector.mode === 'out');
            // Update Connections
            if (currentNode.type !== 'trigger' && node.type === 'trigger' && connectorIn) {
              Object.values(draft)
                .filter(node => node.type === 'connector' && node.to.id === currentNode.id)
                .forEach(node => {
                  delete draft[node.id];
                });

              delete currentNode.connectors[connectorIn.id];
            } else if (currentNode.type !== 'callback' && node.type === 'callback') {
              if (!connectorIn) {
                const idConnectorIn = `connector-${generateID()}`;
                set(draft, `${node.id}.connectors.${idConnectorIn}`, {
                  id: idConnectorIn,
                  mode: 'in',
                  placement: 'left',
                  limit: 1
                });
              }

              if (!connectorOut) {
                const idConnectorOut = `connector-${generateID()}`;
                set(draft, `${node.id}.connectors.${idConnectorOut}`, {
                  id: idConnectorOut,
                  mode: 'out',
                  placement: 'left',
                  limit: undefined
                });
              }
            }
          }

          if (reset) {
            set(draft, node.id, {
              ...currentNode,
              type: 'callback',
              action: '',
              params: {},
              ...node
            });
          } else {
            set(draft, node.id, { ...currentNode, ...node });
          }
        })
      ),
    []
  );

  const updateNodePosition = useCallback(
    (nodeId, x, y) =>
      setNodes(state => {
        const oldX = get(state, `${nodeId}.position.x`);
        const oldY = get(state, `${nodeId}.position.y`);
        if (oldX === x && oldY === y) {
          return state;
        }

        return produce(state, draft => {
          set(draft, `${nodeId}.position`, { x, y });
        });
      }),
    []
  );

  const updateNodeConnector = useCallback(
    (nodeId, connector) =>
      setNodes(state =>
        produce(state, draft => {
          set(draft, `${nodeId}.connectors.${connector.id}`, connector);
        })
      ),
    []
  );

  const getNode = useCallback(nodeId => get(nodes, nodeId), [nodes]);

  const bindNodes = useCallback(
    (nodeFromId, nodeToId, connectorFromId, connectorToId) =>
      setNodes(state =>
        produce(state, draft => {
          // Check Parameters
          if (!nodeFromId || !nodeToId || !connectorFromId || !connectorToId) {
            return;
          }

          const connectorFrom = get(draft, `${nodeFromId}.connectors.${connectorFromId}`);
          const connectorTo = get(draft, `${nodeToId}.connectors.${connectorToId}`);
          // Check if connectors are in this direction out -> in
          if (connectorFrom.mode !== 'out' || connectorTo.mode !== 'in') {
            return;
          }

          // Check Limits in fromNode and toNode connectors
          const draftList = Object.values(draft);
          const fromLimit = draftList.filter(
            node => node.type === 'connector' && node.from.id === nodeFromId && node.from.connector === connectorFromId
          ).length;
          const toLimit = draftList.filter(
            node => node.type === 'connector' && node.to.id === nodeToId && node.to.connector === connectorToId
          ).length;
          if (
            (connectorFrom.limit !== undefined && fromLimit >= connectorFrom.limit) ||
            (connectorTo.limit !== undefined && toLimit >= connectorTo.limit)
          ) {
            return;
          }

          const node = draftList
            .filter(node => node.type === 'connector')
            .find(node => {
              return (
                node.from.id === nodeFromId &&
                node.to.id === nodeToId &&
                node.from.connector === connectorFromId &&
                node.to.connector === connectorToId
              );
            });

          // Check if bind already exist
          if (node) {
            return;
          }

          const id = `node-${generateID()}`;
          draft[id] = {
            id,
            title: 'Connector',
            type: 'connector',
            from: { id: nodeFromId, connector: connectorFromId },
            to: { id: nodeToId, connector: connectorToId }
          };
        })
      ),
    [nodes]
  );

  const wipeNodes = useCallback(() => setNodes({}, []));

  // Layouts

  const getSegment = (size, steps = 1) => size * (1 / steps);

  const getCenter = (size, step = 1, steps = 1) => {
    if (step <= 0) {
      step = 1;
    }

    const segment = getSegment(size, steps);
    const segments = (step - 1) * segment;
    const halfSegment = segment / 2;

    return segments + halfSegment;
  };

  const INITIAL_SEPARATION_NODES = 50;
  const SEPARATION_NODES = 30;

  const processNode = (
    node,
    distance,
    step,
    steps,
    acum,
    offset = INITIAL_SEPARATION_NODES,
    direction = 'horizontal'
  ) => {
    const center = getCenter(distance, step + 1, steps) + distance * offset;
    const nodeDOM = containerRef.current.querySelector(`#${node.id}`);
    switch (direction) {
      case 'vertical': {
        node.position.x = center;
        node.position.y = acum;
        if (nodeDOM) {
          const { offsetWidth, offsetHeight } = nodeDOM;
          node.position.x -= offsetWidth / 2;
          acum += offsetHeight;
        } else {
          acum += 200;
        }

        break;
      }

      case 'horizontal':
      default: {
        node.position.x = acum;
        node.position.y = center;
        if (nodeDOM) {
          const { offsetWidth, offsetHeight } = nodeDOM;
          node.position.y -= offsetHeight / 2;
          acum += offsetWidth;
        } else if (acum > 0) {
          acum += 250;
        }
      }
    }

    return acum;
  };

  const processNodes = (nodes, parentNode, distance, acum = 0, offset = 0, direction = 'horizontal') => {
    const connectors = nodes.filter(node => node.type === 'connector' && node.from.id === parentNode.id);
    connectors.forEach((connector, i) => {
      const node = nodes.find(node => node.id === connector.to.id && connector.from.id === parentNode.id);
      const newAcum = processNode(node, distance, i, connectors.length, acum + SEPARATION_NODES, offset, direction);
      processNodes(
        nodes,
        node,
        getSegment(distance, connectors.length),
        newAcum + SEPARATION_NODES,
        offset + i,
        direction
      );
    });
  };

  const performLayout = useCallback(
    (direction = 'horizontal') => {
      setNodes(state =>
        produce(state, draft => {
          const draftList = Object.values(draft);
          const triggerNodes = draftList.filter(node => node.type === 'trigger');
          const { offsetHeight, offsetWidth } = containerRef.current;
          triggerNodes.forEach((triggerNode, i) => {
            switch (direction) {
              case 'vertical':
                {
                  const acum = processNode(
                    triggerNode,
                    offsetWidth,
                    i,
                    triggerNodes.length,
                    INITIAL_SEPARATION_NODES,
                    0,
                    direction
                  );
                  processNodes(
                    draftList,
                    triggerNode,
                    getSegment(offsetWidth, triggerNodes.length),
                    acum + SEPARATION_NODES,
                    i,
                    direction
                  );
                }

                break;

              case 'horizontal':
              default: {
                const acum = processNode(triggerNode, offsetHeight, i, triggerNodes.length, 0, 0, direction);
                processNodes(
                  draftList,
                  triggerNode,
                  getSegment(offsetHeight, triggerNodes.length),
                  acum + SEPARATION_NODES,
                  i,
                  direction
                );
              }
            }
          });
        })
      );
    },
    [nodes]
  );

  const workflowMemo = useMemo(
    () => ({
      nodes,
      direction,
      containerRef,
      nodeDefinitions,
      registerNode,
      unregisterNode,
      updateNode,
      updateNodePosition,
      updateNodeConnector,
      getNode,
      bindNodes,
      wipeNodes,
      performLayout
    }),
    [
      nodes,
      direction,
      containerRef,
      nodeDefinitions,
      registerNode,
      unregisterNode,
      updateNode,
      updateNodePosition,
      updateNodeConnector,
      getNode,
      bindNodes,
      wipeNodes,
      performLayout
    ]
  );

  return <WorkflowContext value={workflowMemo}>{children}</WorkflowContext>;
};

export default WorkflowContextProvider;
