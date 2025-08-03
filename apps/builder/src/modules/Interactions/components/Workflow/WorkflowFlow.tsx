import { useCallback, use, useMemo, useState } from 'react';

import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';

import WorkflowAddNode from './WorkflowAddNode';
import WorkflowContext from './WorkflowContext';
import WorkflowNode from './WorkflowNode';

import type { ElementInteraction } from '@plitzi/sdk-shared';

export type WorkflowFlowProps = {
  trigger: ElementInteraction;
  nodes?: Record<string, ElementInteraction>;
  triggerTitle?: string;
  callbackTitle?: string;
};

const WorkflowFlow = ({
  trigger,
  nodes = emptyObject,
  triggerTitle = 'When this happens...',
  callbackTitle = 'Do this...'
}: WorkflowFlowProps) => {
  const { addNode, removeNode } = use(WorkflowContext);
  const callbacks = useMemo(() => Object.values(nodes).filter(node => node.type !== 'trigger'), [nodes]);
  const [nodesOpened, setNodesOpened] = useState<Record<string, boolean>>({});

  const handleClickAddCallback = useCallback(
    (siblingNodeId: string) => addNode('callback', siblingNodeId, trigger.id),
    [addNode, trigger]
  );

  const handleNodeOpened = useCallback(
    (id: string, isOpened: boolean) => setNodesOpened(state => ({ ...state, [id]: isOpened })),
    []
  );

  const handleClickRemoveCallback = useCallback((id: string) => removeNode(id), [removeNode]);

  return (
    <div className="flex h-full w-full flex-col items-center py-4">
      <div className="mb-4 flex items-center justify-center rounded-full bg-gray-700 px-4 py-2 text-xs text-white">
        {triggerTitle}
      </div>
      {
        <WorkflowNode
          type="trigger"
          id={trigger.id}
          action={trigger.action}
          elementId={trigger.elementId}
          title={trigger.title}
          enabled={trigger.enabled}
          params={trigger.params}
          when={trigger.when}
          preview={trigger.preview}
          isOpened={nodesOpened[trigger.id]}
          onOpened={handleNodeOpened}
        />
      }
      <div className="my-4 flex items-center justify-center rounded-full bg-gray-700 px-4 py-2 text-xs text-white">
        {callbackTitle}
      </div>
      <div className="flex w-full flex-col">
        {callbacks.map((callback, i) => {
          const { id, action, title, params, when, elementId, beforeNode, afterNode, enabled, type, preview } =
            callback;
          const nextCallback = callbacks[i + 1] as ElementInteraction | undefined;

          return (
            <div key={id} className="flex flex-col items-center">
              <WorkflowNode
                id={id}
                type={type}
                action={action}
                params={params}
                when={when}
                preview={preview}
                elementId={elementId}
                beforeNode={beforeNode}
                afterNode={afterNode}
                triggerId={trigger.id}
                title={title}
                canDelete
                enabled={enabled}
                isOpened={nodesOpened[id]}
                onOpened={handleNodeOpened}
                onRemove={handleClickRemoveCallback}
              />
              <WorkflowAddNode
                id={id}
                onClick={handleClickAddCallback}
                topOpened={nodesOpened[id]}
                bottomOpened={nextCallback && nodesOpened[nextCallback.id]}
                concatenateTop
                concatenateBottom={callbacks.length - 1 !== i}
              />
            </div>
          );
        })}
        {callbacks.length === 0 && <WorkflowAddNode onClick={handleClickAddCallback} id={trigger.id} />}
      </div>
    </div>
  );
};

export default WorkflowFlow;
