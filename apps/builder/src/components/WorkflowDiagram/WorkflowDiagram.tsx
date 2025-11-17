import classNames from 'classnames';
import { useRef } from 'react';

import WorkflowContainer from './WorkflowContainer';
import WorkflowContextProvider from './WorkflowContextProvider';

const nodeDefinitionsDefault = [];

export type WorkflowDiagramProps = {
  className?: string;
  direction?: 'horizontal' | 'vertical';
  template?: object;
  nodeDefinitions?: object[];
  onChange?: (template: object) => void;
  addNodePositionX?: number;
  addNodePositionY?: number;
};

const WorkflowDiagram = ({
  className = '',
  direction = 'horizontal',
  template,
  nodeDefinitions = nodeDefinitionsDefault,
  onChange,
  addNodePositionX = 0,
  addNodePositionY = 0
}: WorkflowDiagramProps) => {
  const ref = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={ref}
      className={classNames(
        'flex min-h-full min-w-full flex-col items-center overflow-auto',
        'bg-[linear-gradient(90deg,#80808014_1px,transparent_0),linear-gradient(180deg,#80808014_1px,transparent_0)] bg-size-[16px_16px]',
        className
      )}
    >
      <WorkflowContextProvider
        containerRef={ref}
        template={template}
        direction={direction}
        nodeDefinitions={nodeDefinitions}
        addNodePositionX={addNodePositionX}
        addNodePositionY={addNodePositionY}
        onChange={onChange}
      >
        <WorkflowContainer />
      </WorkflowContextProvider>
    </div>
  );
};

export default WorkflowDiagram;
