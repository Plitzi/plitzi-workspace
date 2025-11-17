import classNames from 'classnames';
import { use, useEffect } from 'react';

import WorkflowActions from './WorkflowActions';
import WorkflowContext from './WorkflowContext';
import WorkflowNode from './WorkflowNode/WorkflowNode';

export type WorkflowContainerProps = {
  className?: string;
};

const WorkflowContainer = ({ className = '' }: WorkflowContainerProps) => {
  const { nodes, direction, performLayout } = use(WorkflowContext);

  useEffect(() => {
    if (Object.values(nodes).length > 0) {
      performLayout(direction);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction]);

  return (
    <div className={classNames('relative mb-10 flex min-h-[800px] min-w-full grow flex-col', className)}>
      <WorkflowActions className="absolute top-0 right-0 z-40 rounded-bl border-b border-l border-gray-300" />
      {Object.values(nodes).map((node, i) => (
        <WorkflowNode key={i} {...node} />
      ))}
    </div>
  );
};

export default WorkflowContainer;
