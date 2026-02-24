import Button from '@plitzi/plitzi-ui/Button';
import { get } from '@plitzi/plitzi-ui/helpers';
import Select from '@plitzi/plitzi-ui/Select';
import clsx from 'clsx';
import { useCallback, use } from 'react';

import WorkflowContext from './WorkflowContext';

import type { ElementInteraction } from '@plitzi/sdk-shared';
import type { Dispatch, SetStateAction } from 'react';

export type WorkflowHeaderProps = {
  flows: {
    id: string;
    title: string;
    trigger: ElementInteraction;
    nodes: Record<string, ElementInteraction>;
  }[];
  flowId?: string;
  setFlowId: Dispatch<SetStateAction<string | undefined>>;
};

const WorkflowHeader = ({ flows, flowId = '', setFlowId }: WorkflowHeaderProps) => {
  const { addNode, removeNode } = use(WorkflowContext);

  const handleClickAddNode = useCallback(() => addNode('trigger'), [addNode]);

  const handleChangeFlow = useCallback((value: string) => setFlowId(value), [setFlowId]);

  const handleClickRemove = useCallback(() => {
    removeNode(flowId);
    const flowsFiltered = flows.filter(flow => flow.id !== flowId);
    if (flowsFiltered.length === 0) {
      setFlowId(undefined);
    } else {
      setFlowId(get(flowsFiltered, '0.id'));
    }
  }, [flows, flowId, removeNode, setFlowId]);

  return (
    <div
      className={clsx('flex justify-between gap-1 bg-white px-2 py-1', {
        'w-full rounded-2xl border border-gray-300': flows.length > 0
      })}
    >
      {flows.length > 0 && (
        <div className="flex grow basis-0 items-center">
          <Select size="xs" className={{ inputContainer: 'border-none' }} value={flowId} onChange={handleChangeFlow}>
            {flows.map(({ id, title }, index) => (
              <option key={index} value={id}>
                {title}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="flex justify-center gap-2">
        <Button intent="primary" size="xs" className="whitespace-nowrap" onClick={handleClickAddNode}>
          New Flow
        </Button>
        {flowId && (
          <Button intent="danger" size="xs" className="rounded-full" onClick={handleClickRemove} title="Remove Flow">
            <i className="fas fa-trash-alt" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default WorkflowHeader;
