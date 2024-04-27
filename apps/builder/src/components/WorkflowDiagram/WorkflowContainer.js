// Packages
import React, { useCallback, useContext, useEffect } from 'react';
import classNames from 'classnames';

// Relatives
import WorkflowNode from './WorkflowNode/WorkflowNode';
import WorkflowContext from './WorkflowContext';
import WorkflowActions from './WorkflowActions';

const WorkflowContainer = props => {
  const { className = '' } = props;
  const { nodes, direction, performLayout } = useContext(WorkflowContext);

  const handleNodeSelected = useCallback(() => {}, []);

  useEffect(() => {
    if (Object.values(nodes).length > 0) {
      performLayout(direction);
    }
  }, [direction]);

  return (
    <div className={classNames('flex flex-col relative min-w-full min-h-[800px] grow mb-10', className)}>
      <WorkflowActions className="absolute z-40 top-0 right-0 rounded-bl border-l border-b border-gray-300" />
      {nodes && Object.values(nodes).map((node, i) => <WorkflowNode key={i} {...node} onSelect={handleNodeSelected} />)}
    </div>
  );
};

export default WorkflowContainer;
