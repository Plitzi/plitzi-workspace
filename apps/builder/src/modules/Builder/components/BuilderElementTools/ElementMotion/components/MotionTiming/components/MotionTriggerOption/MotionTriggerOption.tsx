import clsx from 'clsx';
import { useCallback } from 'react';

import type { MotionTrigger } from '@plitzi/sdk-shared/schema/motion';

export type MotionTriggerOptionProps = {
  trigger: MotionTrigger;
  label: string;
  selected: boolean;
  onSelect: (trigger: MotionTrigger) => void;
};

const MotionTriggerOption = ({ trigger, label, selected, onSelect }: MotionTriggerOptionProps) => {
  const handleSelect = useCallback(() => onSelect(trigger), [onSelect, trigger]);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={clsx('grow cursor-pointer rounded px-2 py-1 text-xs transition-colors', {
        'bg-white font-medium text-gray-800 shadow-sm dark:bg-zinc-700 dark:text-zinc-100': selected,
        'text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200': !selected
      })}
      onClick={handleSelect}
    >
      {label}
    </button>
  );
};

export default MotionTriggerOption;
