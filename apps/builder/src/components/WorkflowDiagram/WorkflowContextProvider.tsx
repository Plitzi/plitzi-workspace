/* eslint-disable @typescript-eslint/no-dynamic-delete */
import useDidUpdateEffect from '@plitzi/plitzi-ui/hooks/useDidUpdateEffect';
import { produce } from 'immer';
import debounce from 'lodash/debounce';
import get from 'lodash/get';
import has from 'lodash/has';
import set from 'lodash/set';
import { useCallback, useMemo, useState } from 'react';

import { getCenter, getSegment } from './helpers/workflowLayoutUtils';
import { ConnectionLineType } from './types';
import WorkflowContext from './WorkflowContext';
import { generateID } from '../../helpers/utils';

import type { Node, WorkflowDirection, NodeConnection, Connector } from './WorkflowContext';
import type { RefObject } from 'react';

const INITIAL_SEPARATION_NODES = 50;
const SEPARATION_NODES = 30;

export type WorkflowContextProviderProps = {
  children: React.ReactNode;
  template?: { nodes: Record<string, Node> };
  containerRef: RefObject<HTMLDivElement | null>;
  direction?: 'horizontal' | 'vertical';
  connectionLineType?: ConnectionLineType;
  addNodePositionX?: number;
  addNodePositionY?: number;
  onChange?: (template: object) => void;
};

const WorkflowContextProvider = ({
  children,
  template,
  containerRef,
  direction = 'horizontal',
  connectionLineType = ConnectionLineType.Bezier,
  addNodePositionX = 0,
  addNodePositionY = 0,
  onChange
}: WorkflowContextProviderProps) => {
  const [nodes, setNodes] = useState<Record<string, Node>>(() => get(template, 'nodes', {}));
  const onChangeDebounced = useMemo(() => onChange && debounce(onChange, 100), [onChange]);

  useDidUpdateEffect(() => {
    onChangeDebounced?.({ ...template, nodes });
  }, [template]);

  const registerNode = useCallback(
    (node: Node) =>
      setNodes(state =>
        produce(state, draft => {
          if (!containerRef.current) {
            return;
          }

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
    [addNodePositionX, addNodePositionY, containerRef]
  );

  const unregisterNode = useCallback(
    (nodeId: string) =>
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
    (node: Node, reset = false) =>
      setNodes(state =>
        produce(state, draft => {
          if (!has(draft, node.id)) {
            return;
          }

          const currentNode = get(draft, node.id);
          if ((node.type as string) && (currentNode.type === 'root' || currentNode.type === 'node')) {
            const connectorIn = Object.values(currentNode.connectors).find(connector => connector.mode === 'in');
            const connectorOut = Object.values(currentNode.connectors).find(connector => connector.mode === 'out');
            // Update Connections
            if (currentNode.type !== 'root' && node.type === 'root' && connectorIn) {
              Object.values(draft)
                .filter(node => node.type === 'connector' && node.to.id === currentNode.id)
                .forEach(node => {
                  delete draft[node.id];
                });

              delete currentNode.connectors[connectorIn.id];
            } else if (currentNode.type !== 'node' && node.type === 'node') {
              if (!connectorIn) {
                const idConnectorIn = `connector_${generateID()}`;
                set(draft, `${node.id}.connectors.${idConnectorIn}`, {
                  id: idConnectorIn,
                  mode: 'in',
                  placement: 'left',
                  limit: 1
                });
              }

              if (!connectorOut) {
                const idConnectorOut = `connector_${generateID()}`;
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
            set(draft, node.id, { ...currentNode, action: '', params: {}, ...node });
          } else {
            set(draft, node.id, { ...currentNode, ...node });
          }
        })
      ),
    []
  );

  const updateNodePosition = useCallback(
    (nodeId: string, x: number, y: number) =>
      setNodes(state => {
        const oldX = get(state, `${nodeId}.position.x`, 0);
        const oldY = get(state, `${nodeId}.position.y`, 0);
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
    (nodeId: string, connector: Connector) =>
      setNodes(state =>
        produce(state, draft => {
          set(draft, `${nodeId}.connectors.${connector.id}`, connector);
        })
      ),
    []
  );

  const getNode = useCallback((nodeId: string) => get(nodes, nodeId), [nodes]);

  const bindNodes = useCallback(
    (nodeFromId: string, nodeToId: string, connectorFromId: string, connectorToId: string) =>
      setNodes(state =>
        produce(state, draft => {
          // Check Parameters
          if (!nodeFromId || !nodeToId || !connectorFromId || !connectorToId) {
            return;
          }

          const connectorFrom = get(draft, `${nodeFromId}.connectors.${connectorFromId}`) as unknown as Connector;
          const connectorTo = get(draft, `${nodeToId}.connectors.${connectorToId}`) as unknown as Connector;
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

          const id = `node_${generateID()}`;
          draft[id] = {
            id,
            title: 'Connector',
            type: 'connector',
            from: { id: nodeFromId, connector: connectorFromId },
            to: { id: nodeToId, connector: connectorToId },
            position: { x: 0, y: 0 }
          };
        })
      ),
    []
  );

  const wipeNodes = useCallback(() => setNodes({}), []);

  const processNode = useCallback(
    (
      node: Node,
      distance: number,
      step: number,
      steps: number,
      acum: number,
      offset = INITIAL_SEPARATION_NODES,
      direction: WorkflowDirection = 'horizontal'
    ) => {
      const center = getCenter(distance, step + 1, steps) + distance * offset;
      const nodeDOM = containerRef.current?.querySelector(`#${node.id}`) as HTMLElement | undefined;
      switch (direction) {
        case 'vertical': {
          if (!node.position) {
            node.position = { x: 0, y: 0 };
          }

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
          if (!node.position) {
            node.position = { x: 0, y: 0 };
          }

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
    },
    [containerRef]
  );

  const processNodes = useCallback(
    (
      nodes: Node[],
      parentNode: Node | undefined,
      distance: number,
      acum = 0,
      offset = 0,
      direction: WorkflowDirection = 'horizontal'
    ) => {
      const connectors = nodes.filter(
        (node): node is NodeConnection => node.type === 'connector' && node.from.id === parentNode?.id
      );
      connectors.forEach((connector, i) => {
        const node = nodes.find(node => node.id === connector.to.id && connector.from.id === parentNode?.id);
        if (!node) {
          return;
        }

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
    },
    [processNode]
  );

  const performLayout = useCallback(
    (direction: WorkflowDirection = 'horizontal') => {
      setNodes(state =>
        produce(state, draft => {
          if (!containerRef.current) {
            return;
          }

          const draftList = Object.values(draft);
          const triggerNodes = draftList.filter(node => node.type === 'root');
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
    [containerRef, processNode, processNodes]
  );

  const workflowMemo = useMemo(
    () => ({
      nodes,
      direction,
      connectionLineType,
      containerRef,
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
      connectionLineType,
      containerRef,
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
