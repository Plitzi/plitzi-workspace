/* eslint-disable @typescript-eslint/no-dynamic-delete */

import { get, set, omit } from '@plitzi/plitzi-ui/helpers';
import { produce } from 'immer';
import { useCallback, use, useEffect, useMemo, useRef, useState } from 'react';

import DataSourceContext from '@plitzi/sdk-shared/dataSource/DataSourceContext';

import WorkflowContext from './WorkflowContext';
import { generateID } from '../../../../helpers/utils';

import type { WorkflowContextValue } from './WorkflowContext';
import type { ElementInteraction, InteractionCallback, Source, SourceField } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type WorkflowContextProviderProps = {
  children: ReactNode;
  nodes: Record<string, ElementInteraction>;
  direction: 'horizontal' | 'vertical';
  nodeDefinitions?: InteractionCallback[];
  onChange: (nodes: Record<string, ElementInteraction>, debounced?: boolean) => void;
  setFlowId: (flowId: string) => void;
};

const WorkflowContextProvider = ({
  children,
  nodes,
  direction = 'horizontal',
  nodeDefinitions,
  setFlowId,
  onChange
}: WorkflowContextProviderProps) => {
  const { getSources } = use(DataSourceContext);
  const [previewData, setPreviewData] = useState<Record<string, ElementInteraction['preview']>>({});
  const [dataSourceContent, setDataSourceContent] = useState<Record<string, SourceField[]>>({});
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const addNode = useCallback(
    (nodeType: ElementInteraction['type'], siblingNodeId: string = '', flowId: string = '') => {
      const id = `node_${generateID()}`;
      onChange(
        produce(nodesRef.current, draft => {
          if (siblingNodeId && !(draft[siblingNodeId] as ElementInteraction | undefined)) {
            return;
          }

          const newNode = {
            id,
            title: `New ${nodeType}`,
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
          if (!(siblingNodeBefore as ElementInteraction | undefined)) {
            draft[id] = newNode;

            return;
          }

          // Nodes
          const siblingNodeAfter = draft[siblingNodeBefore.afterNode];

          // Update Before Node
          siblingNodeBefore.afterNode = id;

          // Update After sibling
          if (siblingNodeAfter as ElementInteraction | undefined) {
            siblingNodeAfter.beforeNode = id;
          }

          // Set Node relationship
          newNode.afterNode = (siblingNodeAfter as ElementInteraction | undefined)?.id ?? '';
          newNode.beforeNode = siblingNodeBefore.id;

          draft[id] = newNode;
        })
      );

      if (nodeType === 'trigger') {
        setFlowId(id);
      }
    },
    [onChange, setFlowId]
  );

  const updateNode = useCallback(
    (node: ElementInteraction) => {
      onChange(
        produce(nodesRef.current, draft => {
          if (node.id) {
            set(draft, node.id, { ...get(draft, node.id, {}), ...node });
          }
        }),
        true
      );
    },
    [onChange]
  );

  const removeNode = useCallback(
    (nodeId: string) => {
      onChange(
        produce(nodesRef.current, draft => {
          const node = draft[nodeId];
          if (!(node as ElementInteraction | undefined)) {
            return;
          }

          const nodesToDelete: ElementInteraction[] = [];
          if (node.type === 'trigger') {
            // Trigger
            const dependantNodes = Object.values(draft).filter(nodeAux => nodeAux.flowId === node.flowId);
            nodesToDelete.push(...dependantNodes);
          } else {
            // Callback
            nodesToDelete.push(node);
            const beforeNode = draft[node.beforeNode];
            const afterNode = draft[node.afterNode];
            if ((beforeNode as ElementInteraction | undefined) && (afterNode as ElementInteraction | undefined)) {
              beforeNode.afterNode = afterNode.id;
            } else if (beforeNode as ElementInteraction | undefined) {
              beforeNode.afterNode = '';
            }

            if ((afterNode as ElementInteraction | undefined) && (beforeNode as ElementInteraction | undefined)) {
              afterNode.beforeNode = beforeNode.id;
            } else if (afterNode as ElementInteraction | undefined) {
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

  const getNode = useCallback(
    (nodeId: string) => (nodeId ? nodesRef.current[nodeId] : nodesRef.current),
    []
  ) as WorkflowContextValue['getNode'];

  const getDefinition = useCallback(
    (type: ElementInteraction['type'], action: string, elementId: string = '') =>
      nodeDefinitions?.find(n => n.type === type && (!n.elementId || n.elementId === elementId) && n.action === action),
    [nodeDefinitions]
  );

  const moveNode = useCallback(
    (nodeId: string, direction: 'up' | 'down' = 'down') => {
      onChange(
        produce(nodesRef.current, draft => {
          if (!nodeId) {
            return;
          }

          const node = draft[nodeId];
          if (!(draft[nodeId] as ElementInteraction | undefined)) {
            return;
          }

          const beforeNode = draft[node.beforeNode];
          const afterNode = draft[node.afterNode];
          switch (direction) {
            case 'up': {
              // Relationships
              set(draft, `${beforeNode.beforeNode}.afterNode`, node.id);
              if (afterNode as ElementInteraction | undefined) {
                set(draft, `${afterNode.id}.beforeNode`, beforeNode.id);
              }

              // Swap
              set(draft, `${node.id}.beforeNode`, beforeNode.beforeNode);
              set(draft, `${node.id}.afterNode`, beforeNode.id);
              set(draft, `${beforeNode.id}.beforeNode`, node.id);
              if (afterNode as ElementInteraction | undefined) {
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
              if (beforeNode as ElementInteraction | undefined) {
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

  const setPreviewNode = useCallback((id: string, data?: ElementInteraction['preview']) => {
    if (!data) {
      setPreviewData(state => omit(state, [id]) as Record<string, ElementInteraction['preview']>);
    } else {
      setPreviewData(state => ({ ...state, [id]: data }));
    }
  }, []);

  const dataSource = useMemo<Record<string, Source['meta']>>(
    () => Object.values(getSources()).reduce((acum, source) => ({ ...acum, [source.meta.source]: source.meta }), {}),
    [getSources]
  );

  const loadSources = useCallback(async () => {
    const sourcesLoaded = await Object.keys(dataSource).reduce(async (acum, sourceKey) => {
      let fields = dataSource[sourceKey].fields;
      if (typeof fields === 'function') {
        fields = await fields(); // {}
      }

      return { ...(await acum), [sourceKey]: fields };
    }, Promise.resolve({}));
    setDataSourceContent(sourcesLoaded);
  }, [dataSource]);

  useEffect(() => {
    void loadSources();
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
