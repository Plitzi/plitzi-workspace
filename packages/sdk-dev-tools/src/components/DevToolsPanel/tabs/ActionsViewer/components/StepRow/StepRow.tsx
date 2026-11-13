import clsx from 'clsx';
import { useCallback } from 'react';

import LogStatusIcon from '../../../Logs/LogStatusIcon';
import { formatMs, STEP_BAR, STEP_ICON, stepTone } from '../../helpers';

import type { StepBar } from '../../helpers';

export type StepRowProps = {
  bar: StepBar;
  selected: boolean;
  onSelect: (stepId: string) => void;
};

/** One step of a flow: what it was, how it ended, and how much of the run it took. */
const StepRow = ({ bar, selected, onSelect }: StepRowProps) => {
  const { step, offset, width } = bar;
  const handleSelect = useCallback(() => onSelect(step.id), [onSelect, step.id]);

  return (
    <button
      type="button"
      onClick={handleSelect}
      aria-pressed={selected}
      className={clsx('flex w-full flex-col gap-1 rounded px-1.5 py-1 text-left transition-colors', {
        'bg-violet-500/10': selected,
        'hover:bg-ui-hover': !selected
      })}
    >
      <div className="flex items-center gap-1.5 text-[11px]">
        <LogStatusIcon logType={stepTone(step.status)} iconClassName={STEP_ICON[step.status]} />
        <span className="text-ui-fg truncate font-medium">{step.title}</span>
        <span className="text-ui-fg-subtle truncate font-mono text-[10px]">{step.action}</span>
        <span className="text-ui-fg-subtle ml-auto shrink-0 tabular-nums">
          {formatMs(step.endTime - step.startTime)}
        </span>
      </div>
      <div className="bg-ui-raised h-1 w-full rounded-full">
        <div
          className={clsx('h-1 rounded-full', STEP_BAR[step.status])}
          style={{ marginLeft: `${offset * 100}%`, width: `${width * 100}%` }}
        />
      </div>
      {step.error !== undefined && (
        <span className="text-[10px] break-words text-red-600 dark:text-red-400">{step.error}</span>
      )}
    </button>
  );
};

export default StepRow;
