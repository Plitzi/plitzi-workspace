// Packages
import React, { useCallback, useContext } from 'react';
import classNames from 'classnames';
import get from 'lodash/get';
import noop from 'lodash/noop';
import Button from '@plitzi/plitzi-ui-components/Button';
import Select from '@plitzi/plitzi-ui-components/Select';

// Relatives
import WorkflowContext from './WorkflowContext';

const flowsDefault = [];

/**
 * @param {{
 *   className?: string;
 *   flows?: object[];
 *   flowId?: string;
 *   setFlowId?: (flowId: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const WorkflowHeader = props => {
  const { className = '', flows = flowsDefault, flowId = '', setFlowId = noop } = props;
  const { addNode, removeNode } = useContext(WorkflowContext);

  const handleClickAddNode = useCallback(() => addNode('trigger'), [addNode]);

  const handleChangeFlow = useCallback(e => setFlowId(e.target.value), [setFlowId]);

  const handleClickRemove = useCallback(() => {
    removeNode(flowId);
    const flowsFiltered = flows.filter(flow => flow.id !== flowId);
    if (flowsFiltered.length === 0) {
      setFlowId();
    } else {
      setFlowId(get(flowsFiltered, '0.id'));
    }
  }, [flows, flowId, removeNode, setFlowId]);

  return (
    <div
      className={classNames(
        'flex justify-between border border-gray-300 rounded-2xl bg-white px-2 py-1 gap-1',
        className,
        { 'w-full': flows && flows.length > 0 }
      )}
    >
      {flows && flows.length > 0 && (
        <div className="flex basis-0 grow">
          <Select
            className="w-full border-none !ring-0 truncate pr-8 text-xs font-bold"
            value={flowId}
            onChange={handleChangeFlow}
          >
            {flows.map(({ id, title }, index) => (
              <option key={index} value={id}>
                {title}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="flex justify-center gap-2">
        <Button
          intent="custom"
          size="custom"
          className="rounded-xl p-2 text-xs bg-blue-100 hover:bg-blue-200 text-blue-500 w-20"
          onClick={handleClickAddNode}
        >
          New Flow
        </Button>
        {flowId && (
          <Button
            intent="custom"
            size="custom"
            className="flex rounded-full items-start flex items-center px-2 text-sm text-white hover:text-red-100 bg-red-500 w-8 h-8"
            onClick={handleClickRemove}
            title="Remove Flow"
          >
            <i className="fas fa-trash-alt" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default WorkflowHeader;
