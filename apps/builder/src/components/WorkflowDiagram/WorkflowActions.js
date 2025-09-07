// Packages
import React, { useCallback, use } from 'react';
import classNames from 'classnames';
import Button from '@plitzi/plitzi-ui-components/Button';

// Relatives
import WorkflowContext from './WorkflowContext';
import { generateID } from '../../helpers/utils';

/**
 * @param {{
 *   className?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const WorkflowActions = props => {
  const { className = '' } = props;
  const { nodes, direction, registerNode, wipeNodes, performLayout } = use(WorkflowContext);

  const handleClickAddNode = useCallback(() => {
    const id = `node_${generateID()}`;
    const idConnectorToIn = `connector_${generateID()}`;
    const idConnectorToOut = `connector_${generateID()}`;
    if (Object.keys(nodes).length === 0) {
      registerNode({
        id,
        type: 'trigger',
        action: '',
        position: { x: 0, y: 0 },
        connectors: {
          [idConnectorToOut]: { id: idConnectorToOut, mode: 'out', placement: 'right', limit: undefined }
        },
        params: {}
      });
    } else {
      registerNode({
        id,
        type: 'callback',
        action: '',
        position: { x: 0, y: 0 },
        connectors: {
          [idConnectorToIn]: { id: idConnectorToIn, mode: 'in', placement: 'left', limit: 1 },
          [idConnectorToOut]: { id: idConnectorToOut, mode: 'out', placement: 'right', limit: undefined }
        },
        params: {}
      });
    }
  }, [nodes, registerNode]);

  const handleClickLayout = useCallback(() => performLayout(direction), [direction]);

  const handleRemoveAll = useCallback(() => wipeNodes(), [wipeNodes]);

  return (
    <div className={classNames('flex bg-white', className)}>
      <div className="flex py-1 px-2">
        <Button
          intent="custom"
          size="custom"
          className="rounded-sm px-2 text-xs bg-blue-100 hover:bg-blue-200 text-blue-500 mr-4"
          onClick={handleClickLayout}
        >
          Layout
        </Button>
        <Button
          intent="custom"
          size="custom"
          className="rounded-sm px-2 text-xs bg-blue-100 hover:bg-blue-200 text-blue-500"
          onClick={handleClickAddNode}
        >
          + Node
        </Button>
      </div>
      <Button
        intent="custom"
        size="custom"
        className="flex items-center px-2 text-sm text-white hover:text-red-100 bg-red-500"
        onClick={handleRemoveAll}
        title="Remove All Nodes"
      >
        <i className="fas fa-trash-alt" />
      </Button>
    </div>
  );
};

export default WorkflowActions;
