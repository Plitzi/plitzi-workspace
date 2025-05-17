// Packages
import React, { useCallback, use, useEffect, useMemo, useRef, useState } from 'react';
import { produce } from 'immer';
import get from 'lodash/get';
import set from 'lodash/set';
import noop from 'lodash/noop';
import omit from 'lodash/omit';
import upperFirst from 'lodash/upperFirst';

// Monorepo
import DataSourceContext from '@plitzi/sdk-data-source/DataSourceContext';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import BuilderSelectedContext from '@plitzi/sdk-shared/builder/contexts/BuilderSelectedContext';

// Relatives
import WorkflowContext from './WorkflowContext';
import { generateID } from '../../../../helpers/utils';

const nodeDefinitionsDefault = [];

/**
 * @param {{
 *   children: React.ReactNode;
 *   nodes: object;
 *   direction: 'horizontal' | 'vertical';
 *   nodeDefinitions: object[];
 *   onChange: (nodes: object) => void;
 *   setFlowId: (flowId: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const WorkflowContextProvider = props => {
  const {
    children,
    nodes = emptyObject,
    direction = 'horizontal',
    nodeDefinitions = nodeDefinitionsDefault,
    setFlowId = noop,
    onChange = noop
  } = props;
  const { elementSelected } = use(BuilderSelectedContext);
  const { getSources } = use(DataSourceContext);
  const [previewData, setPreviewData] = useState({});
  const [dataSourceContent, setDataSourceContent] = useState({});
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const addNode = useCallback(
    (nodeType, siblingNodeId = '', flowId = '') => {
      const id = `node_${generateID()}`;
      onChange(
        produce(nodesRef.current, draft => {
          if (siblingNodeId && !draft[siblingNodeId]) {
            return;
          }

          const newNode = {
            id,
            title: `New ${upperFirst(nodeType)}`,
            type: nodeType,
            action: '',
            params: {},
            preview: {},
            elementId: '',
            beforeNode: '',
            afterNode: '',
            flowId: nodeType === 'trigger' ? id : flowId,
            enabled: false
          };

          const siblingNodeBefore = draft[siblingNodeId];
          if (!siblingNodeBefore) {
            draft[id] = newNode;

            return;
          }

          // Nodes
          const siblingNodeAfter = draft[siblingNodeBefore.afterNode];

          // Update Before Node
          siblingNodeBefore.afterNode = id;

          // Update After sibling
          if (siblingNodeAfter) {
            siblingNodeAfter.beforeNode = id;
          }

          // Set Node relationship
          newNode.afterNode = siblingNodeAfter?.id ?? '';
          newNode.beforeNode = siblingNodeBefore.id;

          draft[id] = newNode;
        })
      );

      if (nodeType === 'trigger') {
        setFlowId(id);
      }
    },
    [onChange]
  );

  const updateNode = useCallback(
    node => {
      onChange(
        produce(nodesRef.current, draft => {
          if (node && node.id) {
            set(draft, node.id, { ...get(draft, node.id, {}), ...node });
          }
        }),
        true
      );
    },
    [onChange]
  );

  const removeNode = useCallback(
    nodeId => {
      onChange(
        produce(nodesRef.current, draft => {
          const node = draft[nodeId];
          if (!node) {
            return;
          }

          const nodesToDelete = [];
          if (node.type === 'trigger') {
            // Trigger
            const dependantNodes = Object.values(draft).filter(nodeAux => nodeAux.flowId === node.flowId);
            nodesToDelete.push(...dependantNodes);
          } else {
            // Callback
            nodesToDelete.push(node);
            const beforeNode = draft[node.beforeNode];
            const afterNode = draft[node.afterNode];
            if (beforeNode && afterNode) {
              beforeNode.afterNode = afterNode.id;
            } else if (beforeNode) {
              beforeNode.afterNode = '';
            }

            if (afterNode && beforeNode) {
              afterNode.beforeNode = beforeNode.id;
            } else if (afterNode) {
              afterNode.beforeNode = '';
            }
          }

          nodesToDelete.forEach(nodeToDelete => {
            delete draft[nodeToDelete.id];
          });
        })
      );
    },
    [onChange]
  );

  const getNode = useCallback(nodeId => (nodeId ? nodesRef.current[nodeId] : nodesRef.current), []);

  const getDefinition = useCallback(
    (type, action, elementId = '') =>
      nodeDefinitions.find(n => n.type === type && (!n.elementId || n.elementId === elementId) && n.action === action),
    [nodeDefinitions]
  );

  const moveNode = useCallback(
    (nodeId, direction = 'down') => {
      onChange(
        produce(nodesRef.current, draft => {
          if (!nodeId) {
            return;
          }

          const node = draft[nodeId];
          if (!draft[nodeId]) {
            return;
          }

          const beforeNode = draft[node.beforeNode];
          const afterNode = draft[node.afterNode];
          switch (direction) {
            case 'up': {
              // Relationships
              set(draft, `${beforeNode.beforeNode}.afterNode`, node.id);
              if (afterNode) {
                set(draft, `${afterNode.id}.beforeNode`, beforeNode.id);
              }

              // Swap
              set(draft, `${node.id}.beforeNode`, beforeNode.beforeNode);
              set(draft, `${node.id}.afterNode`, beforeNode.id);
              set(draft, `${beforeNode.id}.beforeNode`, node.id);
              if (afterNode) {
                set(draft, `${beforeNode.id}.afterNode`, afterNode.id);
              } else {
                set(draft, `${beforeNode.id}.afterNode`, '');
              }

              break;
            }

            case 'down': {
              // Relationships
              set(draft, `${beforeNode.id}.afterNode`, afterNode.id);
              if (get(draft, `${afterNode.id}.afterNode`)) {
                set(draft, `${afterNode.afterNode}.beforeNode`, node.id);
              }

              // Swap
              set(draft, `${node.id}.beforeNode`, afterNode.id);
              set(draft, `${node.id}.afterNode`, afterNode.afterNode);
              set(draft, `${afterNode.id}.afterNode`, node.id);
              if (beforeNode) {
                set(draft, `${afterNode.id}.beforeNode`, beforeNode.id);
              } else {
                set(draft, `${afterNode.id}.beforeNode`, '');
              }

              break;
            }

            default:
          }
        })
      );
    },
    [onChange]
  );

  const setPreviewNode = useCallback((id, data) => {
    if (data === undefined) {
      setPreviewData(state => omit(state, [id]));
    } else {
      setPreviewData(state => ({ ...state, [id]: data }));
    }
  }, []);

  const dataSource = useMemo(
    () => Object.values(getSources()).reduce((acum, source) => ({ ...acum, [source.meta.source]: source.meta }), {}),
    [elementSelected, getSources]
  );

  const loadSources = useCallback(async () => {
    const sourcesLoaded = await Object.keys(dataSource).reduce(
      async (acum, sourceKey) => ({ ...(await acum), [sourceKey]: (await dataSource[sourceKey].fields(true)) ?? {} }),
      Promise.resolve({})
    );
    setDataSourceContent(sourcesLoaded);
  }, [dataSource]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const workflowMemo = useMemo(
    () => ({
      direction,
      nodeDefinitions,
      previewData,
      dataSource,
      dataSourceContent,
      addNode,
      updateNode,
      removeNode,
      getNode,
      getDefinition,
      moveNode,
      setPreviewNode
    }),
    [
      direction,
      nodeDefinitions,
      previewData,
      dataSource,
      dataSourceContent,
      addNode,
      updateNode,
      removeNode,
      getNode,
      getDefinition,
      moveNode,
      setPreviewNode
    ]
  );

  return <WorkflowContext value={workflowMemo}>{children}</WorkflowContext>;
};

export default WorkflowContextProvider;
