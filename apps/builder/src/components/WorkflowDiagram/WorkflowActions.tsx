import Button from '@plitzi/plitzi-ui/Button';
import classNames from 'classnames';
import { useCallback, use } from 'react';

import WorkflowContext from './WorkflowContext';
import { generateID } from '../../helpers/utils';

export type WorkflowActionsProps = {
  className?: string;
};

const WorkflowActions = ({ className = '' }: WorkflowActionsProps) => {
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
        }
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
        }
      });
    }
  }, [nodes, registerNode]);

  const handleClickLayout = useCallback(() => performLayout(direction), [direction, performLayout]);

  const handleRemoveAll = useCallback(() => wipeNodes(), [wipeNodes]);

  return (
    <div className={classNames('flex bg-white', className)}>
      <div className="flex px-2 py-1">
        <Button
          intent="custom"
          size="custom"
          className="mr-4 rounded-sm bg-blue-100 px-2 text-xs text-blue-500 hover:bg-blue-200"
          onClick={handleClickLayout}
        >
          Layout
        </Button>
        <Button
          intent="custom"
          size="custom"
          className="rounded-sm bg-blue-100 px-2 text-xs text-blue-500 hover:bg-blue-200"
          onClick={handleClickAddNode}
        >
          + Node
        </Button>
      </div>
      <Button
        intent="custom"
        size="custom"
        className="flex items-center bg-red-500 px-2 text-sm text-white hover:text-red-100"
        onClick={handleRemoveAll}
        title="Remove All Nodes"
      >
        <i className="fas fa-trash-alt" />
      </Button>
    </div>
  );
};

export default WorkflowActions;
