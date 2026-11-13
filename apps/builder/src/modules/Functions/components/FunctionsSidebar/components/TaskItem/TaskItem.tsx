import clsx from 'clsx';
import { useCallback } from 'react';

import { timeLabel } from '../../../../helpers';

export type TaskItemProps = {
  name: string;
  title: string;
  /** The CPU it runs with, and whether it asked for it or gets the default. */
  cpu: { ms: number; asked: boolean };
  selected: boolean;
  /** Written, but not in the saved draft yet: nothing can run it until it is saved. */
  unsaved: boolean;
  onSelect: (task: string) => void;
};

/** One task in the list: its title and its step's name, the time it asked for, and whether a save has it yet. */
const TaskItem = ({ name, title, cpu, selected, unsaved, onSelect }: TaskItemProps) => {
  const handleSelect = useCallback(() => onSelect(name), [name, onSelect]);

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
        <span className="text-ui-fg truncate text-xs font-medium">{title || name}</span>
        <span
          className={clsx('shrink-0 rounded-sm px-1 font-mono text-[11px]', {
            'bg-primary-100 text-primary-800 dark:bg-primary-500/20 dark:text-primary-200': cpu.asked,
            'bg-ui-raised text-ui-fg-subtle': !cpu.asked
          })}
          title={cpu.asked ? 'CPU it asked for' : 'Default CPU'}
        >
          {timeLabel(cpu.ms)}
        </span>
      </span>
      <span className="flex items-center gap-1.5">
        <code className="text-ui-fg-subtle truncate text-[11px]">{name}</code>
        {unsaved && (
          <span
            className="shrink-0 text-[11px] font-medium text-amber-700 dark:text-amber-400"
            title="Written, not saved yet: save to run it"
          >
            not saved
          </span>
        )}
      </span>
    </button>
  );
};

export default TaskItem;
