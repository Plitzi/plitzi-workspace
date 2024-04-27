// Packages
import React, { useRef } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import WorkflowContextProvider from './WorkflowContextProvider';
import WorkflowContainer from './WorkflowContainer';

const nodeDefinitionsDefault = [];

/**
 * @param {{
 *   className?: string;
 *   direction?: 'horizontal' | 'vertical';
 *   template?: object;
 *   nodeDefinitions?: object[];
 *   onChange?: (template: object) => void;
 *   addNodePositionX?: number;
 *   addNodePositionY?: number;
 * }} props
 * @returns {React.ReactElement}
 */
const WorkflowDiagram = props => {
  const {
    className = '',
    direction = 'horizontal',
    template = emptyObject,
    nodeDefinitions = nodeDefinitionsDefault,
    onChange = noop,
    addNodePositionX = 0,
    addNodePositionY = 0
  } = props;
  const ref = useRef();

  return (
    <div
      ref={ref}
      className={classNames(
        'flex flex-col items-center min-h-full min-w-full overflow-auto',
        'bg-[linear-gradient(90deg,#80808014_1px,transparent_0),linear-gradient(180deg,#80808014_1px,transparent_0)] bg-[size:16px_16px]',
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
