import Button from '@plitzi/plitzi-ui/Button';
import { get } from '@plitzi/plitzi-ui/helpers';
import Select from '@plitzi/plitzi-ui/Select';
import clsx from 'clsx';
import { useCallback, use } from 'react';

import { WARNING_ICON } from './helpers/nodeWarnings';
import WorkflowContext from './WorkflowContext';

import type { WarningLevel } from './helpers/nodeWarnings';
import type { ElementInteraction } from '@plitzi/sdk-shared';
import type { Dispatch, SetStateAction } from 'react';

type FlowSummary = { count: number; level: WarningLevel | undefined };

export type WorkflowHeaderProps = {
  flows: {
    id: string;
    title: string;
    trigger: ElementInteraction;
    nodes: Record<string, ElementInteraction>;
  }[];
  flowId?: string;
  flowSummaries?: Record<string, FlowSummary>;
  setFlowId: Dispatch<SetStateAction<string | undefined>>;
};

const WorkflowHeader = ({ flows, flowId = '', flowSummaries = {}, setFlowId }: WorkflowHeaderProps) => {
  const { addNode, removeNode } = use(WorkflowContext);
  const currentSummary = flowSummaries[flowId];

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
      className={clsx('flex justify-between gap-1 bg-white px-2 py-1 dark:bg-zinc-800', {
        'w-full rounded-2xl border border-gray-300 dark:border-zinc-600': flows.length > 0
      })}
    >
      {flows.length > 0 && (
        <div className="flex grow basis-0 items-center gap-2">
          <Select size="xs" className={{ inputContainer: 'border-none' }} value={flowId} onChange={handleChangeFlow}>
            {flows.map(({ id, title }, index) => {
              const summary = flowSummaries[id];
              const prefix = summary?.level === 'danger' ? '⛔ ' : summary?.level === 'warning' ? '⚠ ' : '';

              return (
                <option key={index} value={id}>
                  {summary && summary.count > 0 ? `${prefix}${title} (${summary.count})` : title}
                </option>
              );
            })}
          </Select>
          {currentSummary?.level && (
            <i
              className={clsx(WARNING_ICON[currentSummary.level], 'shrink-0')}
              title={`This flow has ${currentSummary.count} step(s) with problems — open the flagged steps to fix them.`}
            />
          )}
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
