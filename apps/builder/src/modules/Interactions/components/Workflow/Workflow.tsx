import classNames from 'classnames';
import debounce from 'lodash/debounce';
import get from 'lodash/get';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import WorkflowContextProvider from './WorkflowContextProvider';
import WorkflowFlow from './WorkflowFlow';
import WorkflowHeader from './WorkflowHeader';

import type { ElementInteraction, InteractionCallback } from '@plitzi/sdk-shared';

export type WorkflowProps = {
  nodes?: Record<string, ElementInteraction>;
  triggerTitle?: string;
  callbackTitle?: string;
  nodeDefinitions?: InteractionCallback[];
  direction?: 'horizontal' | 'vertical';
  onChange?: (nodes: Record<string, ElementInteraction>) => void;
};

const Workflow = ({
  nodes: nodesProp,
  triggerTitle = 'When this happens...',
  callbackTitle = 'Do this...',
  nodeDefinitions,
  direction = 'vertical',
  onChange
}: WorkflowProps) => {
  const [nodes, setNodes] = useState(() => {
    if (Array.isArray(nodesProp)) {
      return {};
    }

    return nodesProp ?? {};
  });
  const onChangeDebounced = useMemo(() => (onChange ? debounce(onChange, 100) : undefined), [onChange]);

  const flows = useMemo(() => {
    const nodesList = Object.values(nodes);
    const triggers = nodesList.filter(node => node.type === 'trigger');

    return triggers.map(trigger => {
      const sequence = {
        id: trigger.id,
        title: trigger.title,
        trigger,
        nodes: {} as Record<string, ElementInteraction>
      };
      let node = trigger;
      while (node as ElementInteraction | undefined) {
        if (sequence.nodes[node.id] as ElementInteraction | undefined) {
          throw new Error('Infinite Loop');
        }

        sequence.nodes[node.id] = node;
        node = nodes[node.afterNode];
      }

      return sequence;
    });
  }, [nodes]);

  const [flowId, setFlowId] = useState<string | undefined>(get(flows, '0.id'));

  const flow = useMemo(() => flows.find(flow => flow.id === flowId), [flowId, flows]);

  const init = useRef(false);
  useEffect(() => {
    if (init.current) {
      if (Array.isArray(nodesProp)) {
        setNodes({});
      } else {
        setNodes(nodesProp ?? {});
      }
    } else {
      init.current = true;
    }
  }, [nodesProp]);

  const handleChange = useCallback(
    (nodes: Record<string, ElementInteraction>, debounced: boolean = false) => {
      if (debounced) {
        setNodes(nodes);
        onChangeDebounced?.(nodes);
      } else {
        onChange?.(nodes);
      }
    },
    [onChange, onChangeDebounced]
  );

  return (
    <div
      className={classNames(
        'flex h-full flex-col items-center p-2',
        'bg-[linear-gradient(90deg,#80808014_1px,transparent_0),linear-gradient(180deg,#80808014_1px,transparent_0)] bg-[size:16px_16px]',
        { 'justify-center': flows.length === 0 }
      )}
    >
      <WorkflowContextProvider
        nodes={nodes}
        onChange={handleChange}
        direction={direction}
        setFlowId={setFlowId}
        nodeDefinitions={nodeDefinitions}
      >
        <WorkflowHeader flows={flows} flowId={flowId} setFlowId={setFlowId} />
        {flow && (
          <WorkflowFlow
            trigger={flow.trigger}
            nodes={flow.nodes}
            triggerTitle={triggerTitle}
            callbackTitle={callbackTitle}
          />
        )}
      </WorkflowContextProvider>
    </div>
  );
};

export default Workflow;
