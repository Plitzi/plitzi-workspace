// Packages
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import get from 'lodash/get';
import debounce from 'lodash/debounce';

// Relatives
import WorkflowFlow from './WorkflowFlow';
import WorkflowHeader from './WorkflowHeader';
import WorkflowContextProvider from './WorkflowContextProvider';
import { emptyObject } from '../../../../helpers/utils';

const Workflow = props => {
  const {
    className = '',
    nodes: nodesProp = emptyObject,
    triggerTitle = 'When this happens...',
    callbackTitle = 'Do this...',
    nodeDefinitions = emptyObject,
    direction = 'vertical',
    onChange = noop
  } = props;
  const [nodes, setNodes] = useState(() => {
    if (Array.isArray(nodesProp)) {
      return {};
    }

    return nodesProp ?? {};
  });
  const onChangeDebounced = useMemo(() => debounce(onChange, 100), [onChange]);

  const flows = useMemo(() => {
    if (!nodes) {
      return [];
    }

    const nodesList = Object.values(nodes);
    const triggers = nodesList.filter(node => node.type === 'trigger');

    return triggers.map(trigger => {
      const sequence = { id: trigger.id, title: trigger.title, trigger, nodes: {} };
      let node = trigger;
      while (node) {
        if (sequence.nodes[node.id]) {
          throw new Error('Infnite Loop');
        }

        sequence.nodes[node.id] = node;
        node = nodes[node.afterNode];
      }

      return sequence;
    });
  }, [nodes]);

  const [flowId, setFlowId] = useState(get(flows, '0.id'));

  const flow = useMemo(() => flows.find(flow => flow.id === flowId), [flowId, flows]);

  const init = useRef(false);
  useEffect(() => {
    if (init.current) {
      if (Array.isArray(nodesProp)) {
        setNodes({});
      } else {
        setNodes(nodesProp);
      }
    } else {
      init.current = true;
    }
  }, [nodesProp]);

  const handleChange = useCallback(
    (nodes, debounced = false) => {
      if (debounced) {
        setNodes(nodes);
        onChangeDebounced(nodes);
      } else {
        onChange(nodes);
      }
    },
    [onChange]
  );

  return (
    <div
      className={classNames(
        'flex flex-col items-center p-4 h-full',
        className,
        'bg-[linear-gradient(90deg,#80808014_1px,transparent_0),linear-gradient(180deg,#80808014_1px,transparent_0)] bg-[size:16px_16px]',
        { 'justify-center': flows && flows.length === 0 }
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

Workflow.propTypes = {
  className: PropTypes.string,
  nodes: PropTypes.object,
  nodeDefinitions: PropTypes.array,
  triggerTitle: PropTypes.string,
  callbackTitle: PropTypes.string,
  direction: PropTypes.oneOf(['horizontal', 'vertical']),
  onChange: PropTypes.func
};

export default Workflow;
