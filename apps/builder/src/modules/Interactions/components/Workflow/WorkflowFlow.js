// Packages
import React, { useCallback, useContext, useMemo, useState } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import WorkflowNode from './WorkflowNode';
import WorkflowAddNode from './WorkflowAddNode';
import WorkflowContext from './WorkflowContext';

const WorkflowFlow = props => {
  const {
    className = '',
    trigger,
    nodes = emptyObject,
    triggerTitle = 'When this happens...',
    callbackTitle = 'Do this...'
  } = props;
  const { addNode, removeNode } = useContext(WorkflowContext);
  const callbacks = useMemo(() => Object.values(nodes).filter(node => node.type !== 'trigger'), [nodes]);
  const [nodesOpened, setNodesOpened] = useState({});

  const handleClickAddCallback = useCallback(
    siblingNodeId => addNode('callback', siblingNodeId, trigger.id),
    [addNode, trigger]
  );

  const handleNodeOpened = useCallback((id, isOpened) => setNodesOpened(state => ({ ...state, [id]: isOpened })), []);

  const handleClickRemoveCallback = useCallback(id => removeNode(id), [removeNode]);

  return (
    <div className={classNames('flex flex-col items-center py-4 h-full w-full', className)}>
      <div className="flex items-center justify-center px-4 py-2 mb-4 bg-gray-700 text-white rounded-full text-xs">
        {triggerTitle}
      </div>
      {trigger && (
        <WorkflowNode
          className="bg-white"
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
          isLastNode
        />
      )}
      <div className="flex items-center justify-center px-4 py-2 my-4 bg-gray-700 text-white rounded-full text-xs">
        {callbackTitle}
      </div>
      <div className="flex flex-col w-full">
        {callbacks &&
          callbacks.map((callback, i) => {
            const { id, action, title, params, when, elementId, beforeNode, afterNode, enabled, type, preview } =
              callback;
            const nextCallback = callbacks[i + 1];

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
                  className="bg-white"
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
                  bottomOpened={nextCallback && nodesOpened[nextCallback?.id]}
                  concatenateTop
                  concatenateBottom={callbacks.length - 1 !== i}
                />
              </div>
            );
          })}
        {callbacks && callbacks.length === 0 && <WorkflowAddNode onClick={handleClickAddCallback} id={trigger.id} />}
      </div>
    </div>
  );
};

WorkflowFlow.propTypes = {
  className: PropTypes.string,
  trigger: PropTypes.object,
  nodes: PropTypes.object,
  triggerTitle: PropTypes.string,
  callbackTitle: PropTypes.string
};

export default WorkflowFlow;
