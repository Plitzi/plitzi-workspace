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
        'bg-white shadow-xs ring-1 ring-gray-200 dark:bg-zinc-800 dark:ring-zinc-700': selected,
        'hover:bg-gray-100 dark:hover:bg-zinc-800/60': !selected
      })}
      onClick={handleSelect}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <i className="fa-solid fa-layer-group shrink-0 text-[11px] text-gray-400 dark:text-zinc-500" />
          <code className="truncate text-xs font-medium text-gray-900 dark:text-zinc-100">{name}</code>
        </span>
        <span
          className={clsx('shrink-0 rounded-sm px-1 font-mono text-[11px]', {
            'bg-primary-100 text-primary-800 dark:bg-primary-500/20 dark:text-primary-200': maxSeconds !== undefined,
            'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400': maxSeconds === undefined
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
