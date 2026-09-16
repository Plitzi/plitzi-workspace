import { useMemo } from 'react';

import { stepBars } from '../../helpers';
import StepRow from '../StepRow';

import type { ActionRunStep } from '@plitzi/sdk-shared';

export type FlowTimelineProps = {
  steps: ActionRunStep[];
  selectedStepId?: string;
  onSelectStep: (stepId: string) => void;
};

/**
 * The flow as it actually ran, in order, with the compensation kept apart from it.
 *
 * The `undo` steps are not more of the flow: they ran BECAUSE it failed, giving back what the steps above them
 * already did. Drawn in the same list they read as a flow that carried on after the failure, which is the opposite
 * of what happened.
 */
const FlowTimeline = ({ steps, selectedStepId, onSelectStep }: FlowTimelineProps) => {
  const bars = useMemo(() => stepBars(steps), [steps]);
  const flow = bars.filter(bar => bar.step.phase === 'flow');
  const undo = bars.filter(bar => bar.step.phase === 'undo');

  return (
    <div className="flex flex-col gap-0.5">
      {flow.map(bar => (
        <StepRow key={bar.step.id} bar={bar} selected={bar.step.id === selectedStepId} onSelect={onSelectStep} />
      ))}
      {undo.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 px-1.5 text-[10px] font-medium tracking-wide text-amber-600 uppercase dark:text-amber-400">
          <i className="fa-solid fa-rotate-left" />
          Compensation
        </div>
      )}
      {undo.map(bar => (
        <StepRow key={bar.step.id} bar={bar} selected={bar.step.id === selectedStepId} onSelect={onSelectStep} />
      ))}
    </div>
  );
};

export default FlowTimeline;
