import clsx from 'clsx';
import { useCallback } from 'react';

import { durationLabel } from '../../../../helpers';

export type JobItemProps = {
  name: string;
  /** How long it may run, every slice together — none when it runs as long as the plan allows. */
  maxSeconds?: number;
  selected: boolean;
  /** Written, but not in the saved draft yet: nothing can start it until it is saved. */
  unsaved: boolean;
  onSelect: (job: string) => void;
};

/** One job in the list: its name, how long it may run, and whether a save has it yet. */
const JobItem = ({ name, maxSeconds, selected, unsaved, onSelect }: JobItemProps) => {
  const handleSelect = useCallback(() => onSelect(name), [name, onSelect]);
  const limit = maxSeconds === undefined ? 'plan' : durationLabel(maxSeconds);
  const limitTitle = maxSeconds === undefined ? 'Runs as long as the plan allows' : 'How long it may run';

  return (
    <button
      type="button"
      className={clsx('flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left', {
        'bg-ui-raised ring-ui-line shadow-xs ring-1': selected,
        'hover:bg-ui-hover': !selected
      })}
      onClick={handleSelect}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <i className="fa-solid fa-layer-group text-ui-fg-subtle shrink-0 text-[11px]" />
          <code className="text-ui-fg truncate text-xs font-medium">{name}</code>
        </span>
        <span
          className={clsx('shrink-0 rounded-sm px-1 font-mono text-[11px]', {
            'bg-primary-100 text-primary-800 dark:bg-primary-500/20 dark:text-primary-200': maxSeconds !== undefined,
            'bg-ui-raised text-ui-fg-subtle': maxSeconds === undefined
          })}
          title={limitTitle}
        >
          {limit}
        </span>
      </span>
      {unsaved && (
        <span
          className="text-[11px] font-medium text-amber-700 dark:text-amber-400"
          title="Written, not saved yet: save to start it"
        >
          not saved
        </span>
      )}
    </button>
  );
};

export default JobItem;
